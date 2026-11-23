// Makes the key pair for notifications to a closed app (Web Push) and prints it as one line of JSON, the private key
// included. Give it straight to the Worker as a secret, without saving it anywhere:
//   node vapid.mjs | npx wrangler secret put VAPID_JWK
// (Run it once. A new pair later means every phone has to turn notifications on again.)
const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const j = await crypto.subtle.exportKey('jwk', k.privateKey);
process.stdout.write(JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y, d: j.d }));
