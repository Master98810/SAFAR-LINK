const token = location.pathname.split("/").pop();
const $ = id => document.getElementById(id);

let watchId = null;
let consented = false;

(async () => {
  try {
    const r = await fetch("/api/share/" + encodeURIComponent(token));
    const d = await r.json();

    if (!r.ok) throw new Error(d.error || "Lien indisponible.");

    $("heading").textContent =
  "Demande de partage de localisation";
  } catch (e) {
    $("status").textContent = e.message;
    $("allow").disabled = true;
  }
})();

$("allow").onclick = async () => {
  $("allow").disabled = true;
  $("status").textContent = "Enregistrement de votre consentement…";

  try {
    const r = await fetch(
      "/api/share/" + encodeURIComponent(token) + "/consent",
      { method: "POST" }
    );

    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Impossible d'enregistrer votre consentement.");

    if (!navigator.geolocation) {
      throw new Error("Le GPS n'est pas disponible dans ce navigateur.");
    }

    consented = true;
    $("status").textContent =
      "Veuillez autoriser l'accès à votre position GPS dans votre navigateur.";

    watchId = navigator.geolocation.watchPosition(
      async pos => {
        try {
          const sent = await fetch(
            "/api/share/" + encodeURIComponent(token) + "/location",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy
              })
            }
          );

          if (!sent.ok) {
            throw new Error("La position n'a pas pu être enregistrée sur le serveur.");
          }

          $("stop").hidden = false;
          $("status").textContent =
            "Votre position est partagée. Vous pouvez arrêter le partage à tout moment.";
        } catch (e) {
          $("status").textContent = e.message;
        }
      },
      err => {
        $("status").textContent =
          "Autorisation GPS ou signal indisponible : " + err.message;
        $("allow").disabled = false;
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  } catch (e) {
    $("status").textContent = e.message;
    $("allow").disabled = false;
  }
};

$("stop").onclick = async () => {
  $("stop").disabled = true;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  try {
    const r = await fetch(
      "/api/share/" + encodeURIComponent(token) + "/revoke",
      { method: "POST" }
    );

    if (!r.ok) {
      throw new Error("Impossible d'arrêter le partage sur le serveur.");
    }

    consented = false;
    $("status").textContent =
      "Vous avez arrêté le partage de votre position. " +
      "Aucune nouvelle mise à jour ne sera envoyée. " +
      "Les enregistrements précédents sont conservés.";

    $("stop").hidden = true;
    $("allow").disabled = true;
  } catch (e) {
    $("status").textContent = e.message;
    $("stop").disabled = false;
  }
};

window.addEventListener("pagehide", () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }
});
