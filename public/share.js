const token=location.pathname.split("/").pop(), status=document.getElementById("status"), allowBtn=document.getElementById("allow"), stopBtn=document.getElementById("stop");
let watchId=null, active=false;
(async()=>{try{const r=await fetch("/api/share/"+encodeURIComponent(token)),d=await r.json();if(!r.ok)throw new Error(d.error);document.getElementById("heading").textContent=d.label+" — Location sharing request";}catch(e){status.textContent=e.message;allowBtn.disabled=true;}})();
allowBtn.onclick=async()=>{
 allowBtn.disabled=true; status.textContent="Saving your consent…";
 try{
  let r=await fetch("/api/share/"+encodeURIComponent(token)+"/consent",{method:"POST"});let d=await r.json();if(!r.ok)throw new Error(d.error);
  if(!navigator.geolocation)throw new Error("GPS is not available in this browser.");
  status.textContent="Grant GPS permission to start location updates.";
  watchId=navigator.geolocation.watchPosition(async pos=>{
   try{const sent=await fetch("/api/share/"+encodeURIComponent(token)+"/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy})});if(!sent.ok)throw new Error("Update rejected");active=true;stopBtn.hidden=false;status.textContent="Your location is being shared. You can stop it at any time.";}
   catch(e){status.textContent="There was a problem sending your location.";}
  },err=>{status.textContent="GPS permission or signal unavailable: "+err.message;allowBtn.disabled=false;},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
 }catch(e){status.textContent=e.message;allowBtn.disabled=false;}
};
stopBtn.onclick=async()=>{stopBtn.disabled=true;if(watchId!==null)navigator.geolocation.clearWatch(watchId);try{const r=await fetch("/api/share/"+encodeURIComponent(token)+"/revoke",{method:"POST"});if(!r.ok)throw new Error("Could not stop sharing on the server.");active=false;status.textContent="Location sharing stopped. Your latest location has been cleared.";stopBtn.hidden=true;allowBtn.disabled=true;}catch(e){status.textContent=e.message;stopBtn.disabled=false;}};
window.addEventListener("pagehide",()=>{if(watchId!==null)navigator.geolocation.clearWatch(watchId);});
