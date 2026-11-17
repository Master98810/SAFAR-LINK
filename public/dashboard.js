const parts=location.pathname.split("/"), sid=parts[parts.length-1], key=new URLSearchParams(location.search).get("key");
const status=document.getElementById("status"), coords=document.getElementById("coords");
let map=null, marker=null;
async function refresh(){
 try{
  const r=await fetch(`/api/dashboard/${sid}?key=${encodeURIComponent(key||"")}`),d=await r.json();if(!r.ok)throw new Error(d.error);
  document.getElementById("label").textContent=d.label;
  if(!d.consent){status.textContent="Waiting for the recipient’s consent…";return;}
  if(!d.location){status.textContent="Consent received; waiting for GPS location…";return;}
  const {latitude,longitude,accuracy}=d.location;
  status.textContent="آخری اپڈیٹ: "+new Date(d.lastUpdate).toLocaleString("ur-PK");
  coords.textContent=`Latitude: ${latitude.toFixed(6)} | Longitude: ${longitude.toFixed(6)} | Accuracy: ${accuracy?Math.round(accuracy)+" m":"Unknown"}`;
  if(!map){map=L.map("map").setView([latitude,longitude],16);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);marker=L.marker([latitude,longitude]).addTo(map);}
  else{marker.setLatLng([latitude,longitude]);map.panTo([latitude,longitude]);}
 }catch(e){status.textContent=e.message;}
}
refresh();setInterval(refresh,5000);
document.getElementById("stop").onclick=async()=>{if(!confirm("Are you sure you want to end this session?"))return;await fetch(`/api/dashboard/${sid}/stop`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key})});status.textContent="Session ended.";};

document.getElementById("googleMaps").onclick=()=>{if(!marker)return;const p=marker.getLatLng();window.open(`https://www.google.com/maps?q=${p.lat},${p.lng}`,"_blank","noopener");};
