const functions = require("firebase-functions");
const admin     = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ── Helpers internos ──────────────────────────────────────────────────────────

async function obtenerAdminDoc(uid) {
  const snap = await db.collection("usuarios").doc(uid).get();
  if (!snap.exists) return null;
  return { uid, ...snap.data() };
}

async function verificarMaestroActivo(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "No autenticado.");
  }
  const datos = await obtenerAdminDoc(context.auth.uid);
  if (!datos) {
    throw new functions.https.HttpsError("permission-denied", "Cuenta no encontrada.");
  }
  const rolNorm = datos.rol === "premium" ? "senior" : datos.rol;
  if (rolNorm !== "maestro") {
    throw new functions.https.HttpsError("permission-denied", "Solo el Maestro puede realizar esta acción.");
  }
  if (datos.activo === false) {
    throw new functions.https.HttpsError("permission-denied", "Cuenta de Maestro suspendida.");
  }
  return datos;
}

async function verificarAdminObjetivo(uid) {
  const datos = await obtenerAdminDoc(uid);
  if (!datos || datos.esAdmin !== true) {
    throw new functions.https.HttpsError("not-found", "Administrador no encontrado.");
  }
  return datos;
}

// ── adminCambiarPassword ──────────────────────────────────────────────────────
// Cambia la contraseña de un administrador en Firebase Authentication.
// Solo el Maestro activo puede invocarla.
exports.adminCambiarPassword = functions.https.onCall(async (data, context) => {
  await verificarMaestroActivo(context);

  const { uidObjetivo, nuevaPassword } = data;
  if (!uidObjetivo || typeof nuevaPassword !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos requeridos.");
  }
  if (nuevaPassword.length < 6) {
    throw new functions.https.HttpsError("invalid-argument", "La contraseña debe tener mínimo 6 caracteres.");
  }

  // Verificar que el objetivo es administrador (puede ser el propio Maestro sobre sí mismo)
  await verificarAdminObjetivo(uidObjetivo);

  await admin.auth().updateUser(uidObjetivo, { password: nuevaPassword });
  return { ok: true };
});

// ── adminCambiarCorreo ────────────────────────────────────────────────────────
// Cambia el correo de un administrador en Auth y Firestore.
// Si Auth falla, Firestore no se toca.
// Si Firestore falla, revierte Auth.
exports.adminCambiarCorreo = functions.https.onCall(async (data, context) => {
  const LOG = (paso, extra) => console.log(JSON.stringify({ fn: "adminCambiarCorreo", paso, ...extra }));

  LOG("inicio", { callerUid: context.auth && context.auth.uid, data: { uidObjetivo: data && data.uidObjetivo, nuevoCorreo: data && data.nuevoCorreo } });

  try {
    await verificarMaestroActivo(context);
  } catch (e) {
    LOG("error-verificarMaestro", { code: e.code, message: e.message });
    throw e;
  }

  const { uidObjetivo, nuevoCorreo } = data;
  if (!uidObjetivo || !nuevoCorreo) {
    LOG("error-argFaltante", { uidObjetivo, nuevoCorreo });
    throw new functions.https.HttpsError("invalid-argument", "Faltan datos requeridos.");
  }
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(nuevoCorreo)) {
    LOG("error-formatoCorreo", { nuevoCorreo });
    throw new functions.https.HttpsError("invalid-argument", "Formato de correo inválido.");
  }

  let objetivoDatos;
  try {
    objetivoDatos = await verificarAdminObjetivo(uidObjetivo);
  } catch (e) {
    LOG("error-verificarObjetivo", { uidObjetivo, code: e.code, message: e.message });
    throw e;
  }
  const correoAnterior = objetivoDatos.correo || objetivoDatos.email || "";
  LOG("objetivo-ok", { uidObjetivo, correoAnterior });

  // Verificar que el correo no esté en uso — flag evita instanceof issue en v5
  let _emailTomado = false;
  try {
    const existente = await admin.auth().getUserByEmail(nuevoCorreo);
    LOG("getUserByEmail-ok", { encontradoUid: existente.uid, uidObjetivo });
    if (existente.uid !== uidObjetivo) _emailTomado = true;
  } catch (lookupErr) {
    LOG("getUserByEmail-error", { code: lookupErr.code, message: lookupErr.message });
    // auth/user-not-found → correo libre
  }
  if (_emailTomado) {
    LOG("correo-tomado", { nuevoCorreo });
    throw new functions.https.HttpsError("already-exists", "Ese correo ya está registrado.");
  }
  LOG("correo-libre", { nuevoCorreo });

  // 1. Actualizar Authentication
  try {
    await admin.auth().updateUser(uidObjetivo, { email: nuevoCorreo });
    LOG("auth-actualizado", { uidObjetivo, nuevoCorreo });
  } catch (authErr) {
    const _c = authErr.code || (authErr.errorInfo && authErr.errorInfo.code) || "";
    LOG("auth-error", { code: _c, message: authErr.message, errorInfo: authErr.errorInfo });
    if (_c === "auth/email-already-exists" || _c === "auth/email-already-in-use") {
      throw new functions.https.HttpsError("already-exists", "Ese correo ya está registrado.");
    }
    throw new functions.https.HttpsError("internal", "Error al actualizar correo: " + authErr.message);
  }

  // 2. Actualizar Firestore
  try {
    await db.collection("usuarios").doc(uidObjetivo).update({ correo: nuevoCorreo });
    LOG("firestore-actualizado", { uidObjetivo, nuevoCorreo });
  } catch (fsErr) {
    LOG("firestore-error", { code: fsErr.code, message: fsErr.message });
    if (correoAnterior) {
      await admin.auth().updateUser(uidObjetivo, { email: correoAnterior }).catch((revertErr) => {
        LOG("auth-revert-error", { message: revertErr.message });
      });
      LOG("auth-revertido", { correoAnterior });
    }
    throw new functions.https.HttpsError("internal", "Error al actualizar base de datos: " + fsErr.message);
  }

  LOG("exito", { uidObjetivo, nuevoCorreo });
  return { ok: true };
});

// ── adminEliminarCuenta ───────────────────────────────────────────────────────
// Elimina un administrador de Firebase Authentication y Firestore.
// Protege al último Maestro activo y al Maestro conectado.
exports.adminEliminarCuenta = functions.https.onCall(async (data, context) => {
  await verificarMaestroActivo(context);

  const { uidObjetivo } = data;
  if (!uidObjetivo) {
    throw new functions.https.HttpsError("invalid-argument", "Falta el UID del administrador.");
  }
  if (uidObjetivo === context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "No puedes eliminar tu propia cuenta de Maestro.");
  }

  const objetivoDatos = await verificarAdminObjetivo(uidObjetivo);
  const rolNorm = objetivoDatos.rol === "premium" ? "senior" : objetivoDatos.rol;

  if (rolNorm === "maestro") {
    // Verificar que no sea el último maestro activo
    const maestrosSnap = await db.collection("usuarios")
      .where("esAdmin", "==", true)
      .where("rol", "in", ["maestro"])
      .where("activo", "!=", false)
      .get();
    if (maestrosSnap.size <= 1) {
      throw new functions.https.HttpsError("permission-denied", "No se puede eliminar al último Maestro activo.");
    }
  }

  // 1. Eliminar de Firebase Authentication
  await admin.auth().deleteUser(uidObjetivo);

  // 2. Eliminar de Firestore
  await db.collection("usuarios").doc(uidObjetivo).delete();

  return { ok: true };
});

// ── adminEliminarUsuario ──────────────────────────────────────────────────────
// Elimina un vecino o proveedor de Firebase Authentication y Firestore.
// Solo el Maestro activo puede invocarla.
exports.adminEliminarUsuario = functions.https.onCall(async (data, context) => {
  const LOG = (paso, extra) => console.log(JSON.stringify({ fn: "adminEliminarUsuario", paso, ...extra }));

  LOG("inicio", { callerUid: context.auth && context.auth.uid, data: { uidObjetivo: data && data.uidObjetivo } });

  try {
    await verificarMaestroActivo(context);
  } catch (e) {
    LOG("error-verificarMaestro", { code: e.code, message: e.message });
    throw e;
  }

  const { uidObjetivo } = data;
  if (!uidObjetivo) {
    LOG("error-argFaltante");
    throw new functions.https.HttpsError("invalid-argument", "Falta el UID del usuario.");
  }
  if (uidObjetivo === context.auth.uid) {
    LOG("error-autoEliminacion", { uidObjetivo });
    throw new functions.https.HttpsError("permission-denied", "No puedes eliminar tu propia cuenta.");
  }

  // Eliminar de Firebase Authentication (tolerar si ya no existe)
  try {
    await admin.auth().deleteUser(uidObjetivo);
    LOG("auth-eliminado", { uidObjetivo });
  } catch (e) {
    LOG("auth-error", { code: e.code, message: e.message });
    if (e.code !== "auth/user-not-found") {
      throw new functions.https.HttpsError("internal", "Error al eliminar de Authentication: " + e.message);
    }
    LOG("auth-noEncontrado-ignorado", { uidObjetivo });
  }

  // Eliminar de Firestore
  try {
    await db.collection("usuarios").doc(uidObjetivo).delete();
    LOG("firestore-eliminado", { uidObjetivo });
  } catch (fsErr) {
    LOG("firestore-error", { code: fsErr.code, message: fsErr.message });
    throw new functions.https.HttpsError("internal", "Error al eliminar de Firestore: " + fsErr.message);
  }

  LOG("exito", { uidObjetivo });
  return { ok: true };
});
