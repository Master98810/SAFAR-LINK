const token=location.pathname.split("/").pop(),$=id=>document.getElementById(id);
let watchId=null,consented=false;
(async()=>{try{const r=await fetch("/api/share/"+encodeURIComponent(token)),d=await r.json();if(!r.ok)throw new Error(d.error);$("heading").textContent=d.label+" — لوکیشن شیئر کرنے کی درخواست";}catch(e){$("status").textContent=e.message;$("allow").disabled=true;}})();
$("allow").onclick=async()=>{
 $("allow").disabled=true;$("status").textContent="آپ کی اجازت محفوظ کی جا رہی ہے…";
 try{
  let r=await fetch("/api/share/"+encodeURIComponent(token)+"/consent",{method:"POST"}),d=await r.json();if(!r.ok)throw new Error(d.error);
  if(!navigator.geolocation)throw new Error("اس براؤزر میں GPS دستیاب نہیں۔");
  consented=true;$("status").textContent="براہِ کرم براؤزر میں GPS اجازت دیں۔";
  watchId=navigator.geolocation.watchPosition(async pos=>{
   try{const sent=await fetch("/api/share/"+encodeURIComponent(token)+"/location",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy})});if(!sent.ok)throw new Error("لوکیشن سرور پر محفوظ نہیں ہوئی");$("stop").hidden=false;$("status").textContent="آپ کی لوکیشن شیئر ہو رہی ہے۔ آپ کسی بھی وقت اسے روک سکتے ہیں۔";}
   catch(e){$("status").textContent=e.message;}
  },err=>{$("status").textContent="GPS اجازت یا سگنل دستیاب نہیں: "+err.message;$("allow").disabled=false;},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
 }catch(e){$("status").textContent=e.message;$("allow").disabled=false;}
};
$("stop").onclick=async()=>{
 $("stop").disabled=true;if(watchId!==null)navigator.geolocation.clearWatch(watchId);
 try{const r=await fetch("/api/share/"+encodeURIComponent(token)+"/revoke",{method:"POST"});if(!r.ok)throw new Error("سرور پر شیئرنگ بند نہیں ہو سکی۔");consented=false;$("status").textContent="آپ نے لوکیشن شیئرنگ روک دی ہے۔ مزید اپڈیٹس نہیں بھیجی جائیں گی۔ پرانے ریکارڈ برقرار رہیں گے۔";$("stop").hidden=true;$("allow").disabled=true;}
 catch(e){$("status").textContent=e.message;$("stop").disabled=false;}
};
window.addEventListener("pagehide",()=>{if(watchId!==null)navigator.geolocation.clearWatch(watchId);});