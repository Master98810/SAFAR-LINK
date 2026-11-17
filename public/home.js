document.getElementById("create").onclick = async () => {
 const btn=document.getElementById("create"), out=document.getElementById("result");
 btn.disabled=true; out.textContent="Creating link…";
 try {
  const r=await fetch("/api/sessions",{method:"POST",headers:{"Content-Type":"application/json","x-admin-key":document.getElementById("admin").value},body:JSON.stringify({label:document.getElementById("label").value,durationMinutes:document.getElementById("duration").value})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error||"Something went wrong");
  out.innerHTML=`<h3>Link created</h3><p>Share link:</p><p><a href="${d.shareUrl}" target="_blank">${d.shareUrl}</a></p><button id="wa">Share link</button><p>Your private dashboard:</p><p><a href="${d.dashboardUrl}" target="_blank">Open dashboard</a></p><p class="hint">Keep the dashboard link private. Do not share it.</p>`;
  document.getElementById("wa").onclick=async()=>{const text="Please open this link and choose whether to share your location: "+d.shareUrl;try{if(navigator.share) await navigator.share({title:"SAFAR LINK",text,url:d.shareUrl});else window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");}catch(e){if(e.name!=="AbortError") window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");}};
 } catch(e){out.textContent=e.message;} finally{btn.disabled=false;}
};
