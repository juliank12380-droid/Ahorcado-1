# Configuración del juego

Arquitectura de datos:

| Dónde | Qué guarda |
|---|---|
| **Cloud Firestore** | Usuarios y perfiles: nombre, color predeterminado, partidas y victorias |
| **Realtime Database** | Partidas en vivo (`/rooms/{CODIGO}`) y correos del formulario (`/verified_emails/...`) |
| **PostgreSQL (servidor)** | Motor autoritativo de la partida: valida turnos, vidas y palabras |
| **Firebase Auth** | Acceso con Google y con correo/contraseña |

---

## 1. Firebase Authentication

En [Authentication → Sign-in method](https://console.firebase.google.com/project/ahorcado-ac3a5/authentication/providers):

- Habilita **Google**.
- Habilita **Correo electrónico/contraseña**. ✅ (ya activado)

En **Authentication → Settings → Authorized domains** agrega el dominio donde publiques el juego.

---

## 2. Cloud Firestore (usuarios)

Crea la base en [Firestore Database](https://console.firebase.google.com/project/ahorcado-ac3a5/firestore) y publica estas reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /profiles/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 3. Realtime Database (partidas y correos verificados)

Reglas en [Realtime Database → Reglas](https://console.firebase.google.com/project/ahorcado-ac3a5/database/rules):

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true
    },
    "verified_emails": {
      ".read": true,
      ".write": true
    }
  }
}
```

> La palabra secreta **nunca** se publica en RTDB mientras la ronda está en curso:
> el servidor solo la incluye cuando la ronda terminó y ya es pública para todos.

---

## 4. Apps Script: del formulario a Firebase

Este script copia los correos del formulario de términos a Realtime Database.
El juego los consulta ahí para dejar entrar a esa persona.

### Pasos

1. Abre la **hoja de respuestas** del formulario.
2. **Extensiones → Apps Script**.
3. Pega este código y guarda:

```javascript
// URL de tu Realtime Database
var RTDB_URL = 'https://ahorcado-ac3a5-default-rtdb.firebaseio.com';

/** Convierte el correo en clave válida para Firebase (sin . # $ [ ] /) */
function claveDeCorreo(correo) {
  return String(correo).trim().toLowerCase().replace(/[.#$\[\]\/]/g, '_');
}

/** Envía un correo verificado a Realtime Database */
function guardarEnFirebase(correo) {
  if (!correo) return;
  var clave = claveDeCorreo(correo);
  var datos = {
    email: String(correo).trim().toLowerCase(),
    accepted: true,
    timestamp: new Date().toISOString()
  };
  UrlFetchApp.fetch(RTDB_URL + '/verified_emails/' + clave + '.json', {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(datos),
    muteHttpExceptions: true
  });
}

/** Se dispara con cada respuesta nueva del formulario */
function alRecibirRespuesta(e) {
  var correo = '';

  // 1) Si el formulario recopila el correo automáticamente
  if (e && e.response && e.response.getRespondentEmail) {
    correo = e.response.getRespondentEmail();
  }
  // 2) Si no, busca la primera respuesta que parezca un correo
  if (!correo && e && e.values) {
    for (var i = 0; i < e.values.length; i++) {
      if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(e.values[i]).trim())) {
        correo = String(e.values[i]).trim();
        break;
      }
    }
  }
  guardarEnFirebase(correo);
}

/** Ejecuta esto UNA vez a mano para subir las respuestas que ya tenías */
function sincronizarTodo() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var datos = hoja.getDataRange().getValues();
  for (var f = 1; f < datos.length; f++) {
    for (var c = 0; c < datos[f].length; c++) {
      var valor = String(datos[f][c]).trim();
      if (/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(valor)) {
        guardarEnFirebase(valor);
        break;
      }
    }
  }
}
```

4. **Activa el disparador**: icono del reloj (Activadores) → *Añadir activador*:
   - Función: `alRecibirRespuesta`
   - Origen del evento: **Desde una hoja de cálculo**
   - Tipo de evento: **Al enviarse el formulario**
5. Ejecuta `sincronizarTodo` una vez para cargar las respuestas anteriores.

### Cómo lo verifica el juego

Cuando alguien escribe su correo en el juego, el servidor consulta en este orden:

1. Caché local en PostgreSQL (instantáneo si ya se verificó antes).
2. **Realtime Database** `/verified_emails/{clave}` ← lo que escribe el Apps Script.
3. `TERMS_FORM_ENDPOINT` del `.env` (opcional, por si prefieres un Apps Script tipo API).

Si no aparece en ninguno, el juego lo manda a llenar el formulario o a jugar
en modo local (mismo teléfono / LAN).
