
const token = location.pathname.split("/").pop();
const $ = id => document.getElementById(id);
let watchId = null;
let consented = false;

// Keep the new controls available while the matching page update is deploying.
const status = $("status");
for (const [id, text] of [["locationSettings", "Ouvrir les paramètres de localisation"], ["retry", "Réessayer ma localisation"]]) {
  if (!$(id)) {
    const button = document.createElement("button");
    button.id = id; button.type = "button"; button.textContent = text; button.hidden = true;
    status.insertAdjacentElement("beforebegin", button);
  }
}
(async () => {
  try {
    const response = await fetch("/api/share/" + encodeURIComponent(token));
    const data = await response.json();
    if (!response.ok) throw new Error("Ce lien n’est plus disponible ou a expiré.");
        $("heading").textContent = "Demande de partage de position";
  } catch (error) {
    $("status").textContent = error.message || "Impossible de charger cette demande.";
    $("allow").disabled = true;
  }
})();
function showLocationError(error) {
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null; $("stop").hidden = true; $("retry").hidden = false;
  if (error && error.code === 1) {
    $("status").textContent = "L’accès à votre position est refusé. Autorisez la localisation pour ce site dans les paramètres de votre navigateur, puis réessayez.";
    $("locationSettings").hidden = true;
  } else if (error && error.code === 2) {
    $("status").textContent = "La localisation de votre téléphone est désactivée ou indisponible. Activez-la dans les paramètres, revenez sur cette page, puis appuyez sur « Réessayer ma localisation ».";
    $("locationSettings").hidden = !/Android/i.test(navigator.userAgent);
  } else {
    $("status").textContent = "Votre position n’a pas pu être obtenue. Vérifiez les réglages de localisation, puis réessayez.";
    $("locationSettings").hidden = !/Android/i.test(navigator.userAgent);
  }
}
function startLocationWatch() {
  if (!navigator.geolocation) {
    $("status").textContent = "La géolocalisation n’est pas disponible dans ce navigateur."; $("retry").hidden = false; return;
  }
  $("retry").hidden = true; $("locationSettings").hidden = true;
  $("status").textContent = "Recherche de votre position… Autorisez l’accès si votre navigateur le demande.";
  watchId = navigator.geolocation.watchPosition(async position => {
    try {
      const response = await fetch("/api/share/" + encodeURIComponent(token) + "/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }) });
      if (!response.ok) throw new Error("Votre position n’a pas pu être enregistrée.");
      $("stop").hidden = false; $("retry").hidden = true; $("locationSettings").hidden = true;
      $("status").textContent = "Votre position est partagée. Vous pouvez arrêter le partage à tout moment.";
    } catch (error) { $("status").textContent = error.message || "Une erreur est survenue pendant le partage."; }
  }, showLocationError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
}
$("allow").onclick = async () => {
  $("allow").disabled = true; $("status").textContent = "Enregistrement de votre accord…";
  try {
    const response = await fetch("/api/share/" + encodeURIComponent(token) + "/consent", { method: "POST" });
    if (!response.ok) throw new Error("Votre accord n’a pas pu être enregistré. Veuillez réessayer.");
    consented = true; $("allow").hidden = true; startLocationWatch();
  } catch (error) { $("status").textContent = error.message || "Impossible d’enregistrer votre accord."; $("allow").disabled = false; }
};
$("locationSettings").onclick = () => {
  $("status").textContent = "Activez la localisation dans les paramètres qui s’ouvrent. Revenez ensuite sur cette page et appuyez sur « Réessayer ma localisation ».";
  const fallback = encodeURIComponent(location.href);
  window.location.href = "intent:#Intent;action=android.settings.LOCATION_SOURCE_SETTINGS;category=android.intent.category.BROWSABLE;S.browser_fallback_url=" + fallback + ";end";
};
$("retry").onclick = () => { if (consented) startLocationWatch(); };
$("stop").onclick = async () => {
  $("stop").disabled = true; if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); watchId = null;
  try {
    const response = await fetch("/api/share/" + encodeURIComponent(token) + "/revoke", { method: "POST" });
    if (!response.ok) throw new Error("Le partage n’a pas pu être arrêté. Veuillez réessayer.");
    consented = false; $("status").textContent = "Vous avez arrêté le partage de votre position. Aucune nouvelle position ne sera envoyée. Les enregistrements précédents sont conservés.";
    $("stop").hidden = true; $("retry").hidden = true; $("locationSettings").hidden = true; $("allow").disabled = true;
  } catch (error) { $("status").textContent = error.message || "Impossible d’arrêter le partage."; $("stop").disabled = false; }
};
window.addEventListener("pagehide", () => { if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId); });
