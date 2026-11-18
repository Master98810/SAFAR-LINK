const parts=location.pathname.split("/"),sid=parts[parts.length-1],key=new URLSearchParams(location.search).get("key");
const $=id=>document.getElementById(id);let map=null,marker=null,lastPoint=null;
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function refresh(){
 try{
  const r=await fetch(`/api/dashboard/${encodeURIComponent(sid)}?key=${encodeURIComponent(key||"")}`),d=await r.json();if(!r.ok)throw new Error(d.error);
  $("label").textContent=`${d.label}${d.phone?" — "+d.phone:""}`;
  if(d.stopped){$("status").textContent="یہ شیئرنگ سیشن بند ہے۔ پرانی ہسٹری محفوظ ہے۔";}
  else if(!d.consent){$("status").textContent="وصول کنندہ کی اجازت کا انتظار ہے…";}
  else if(!d.location){$("status").textContent="اجازت مل گئی؛ GPS لوکیشن کا انتظار ہے…";}
  const h=d.history||[];
  if(h.length){
   const p=h[0];lastPoint=p;
   $("status").textContent=(d.stopped?"سیشن بند۔ آخری اپڈیٹ: ":"آخری اپڈیٹ: ")+new Date(p.recordedAt).toLocaleString("ur-PK");
   $("coords").textContent=`Latitude: ${p.latitude.toFixed(6)} | Longitude: ${p.longitude.toFixed(6)} | Accuracy: ${p.accuracy?Math.round(p.accuracy)+" m":"نامعلوم"}`;
   if(!map){map=L.map("map").setView([p.latitude,p.longitude],16);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(map);marker=L.marker([p.latitude,p.longitude]).addTo(map);}
   else{marker.setLatLng([p.latitude,p.longitude]);map.panTo([p.latitude,p.longitude]);}
  }
  $("history").innerHTML=h.map(p=>`<article class="history-item"><strong>${new Date(p.recordedAt).toLocaleString("ur-PK")}</strong><br>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}<br><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${p.latitude},${p.longitude}">Google Maps میں مقام کھولیں</a></article>`).join("")||"ابھی کوئی لوکیشن ریکارڈ نہیں۔";
 }catch(e){$("status").textContent=e.message;}
}
refresh();setInterval(refresh,10000);
$("stop").onclick=async()=>{if(!confirm("کیا آپ یہ سیشن بند کرنا چاہتے ہیں؟ پرانی ہسٹری محفوظ رہے گی۔"))return;const r=await fetch(`/api/dashboard/${encodeURIComponent(sid)}/stop`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key})});const d=await r.json();$("status").textContent=r.ok?"شیئرنگ بند کر دی گئی۔ پرانی ہسٹری محفوظ ہے۔":(d.error||"خرابی");refresh();};
$("googleMaps").onclick=()=>{if(lastPoint)window.open(`https://www.google.com/maps?q=${lastPoint.latitude},${lastPoint.longitude}`,"_blank","noopener");};