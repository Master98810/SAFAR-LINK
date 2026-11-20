const $ = id => document.getElementById(id);
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("create").onclick = async () => {
 const btn=$("create"), out=$("result"); btn.disabled=true; out.textContent="لنک بنایا جا رہا ہے…";
 try{
  const r=await fetch("/api/sessions",{method:"POST",headers:{"Content-Type":"application/json","x-admin-key":$("admin").value},body:JSON.stringify({label:$("label").value,phone:$("phone").value,durationMinutes:$("duration").value})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error||"خرابی پیش آئی");
  out.innerHTML=`<h3>لنک بن گیا</h3><p>شیئر لنک:</p><p><a href="${escapeHtml(d.shareUrl)}" target="_blank" rel="noopener">${escapeHtml(d.shareUrl)}</a></p><button id="wa">WhatsApp پر بھیجیں</button><p>آپ کا نجی ڈیش بورڈ:</p><p><a href="${escapeHtml(d.dashboardUrl)}" target="_blank" rel="noopener">ڈیش بورڈ کھولیں</a></p><p class="hint">ڈیش بورڈ کا لنک خفیہ رکھیں۔</p>`;
  $("wa").onclick=()=>{const text="Veuillez ouvrir ce lien et autoriser le partage de votre position si vous le souhaitez : "+d.shareUrl;window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank","noopener");};
  loadLinks();
 }catch(e){out.textContent=e.message;}finally{btn.disabled=false;}
};
async function loadLinks(){
 const out=$("links"); out.textContent="لوڈ ہو رہا ہے…";
 try{
  const r=await fetch("/api/sessions",{headers:{"x-admin-key":$("admin").value}}),d=await r.json(); if(!r.ok)throw new Error(d.error||"فہرست دستیاب نہیں");
  out.innerHTML=d.sessions.map(s=>`<article class="history-item"><strong>${escapeHtml(s.label)}</strong> — ${escapeHtml(s.phone||"فون نمبر درج نہیں")}<br><small>بنایا گیا: ${new Date(s.createdAt).toLocaleString("ur-PK")}</small><br><small>حالت: ${s.stopped?"بند":s.expiresAt<Date.now()?"مدت ختم":s.consent?"اجازت مل گئی":"اجازت کا انتظار"}</small></article>`).join("")||"ابھی کوئی لنک موجود نہیں۔";
 }catch(e){out.textContent=e.message;}
}
$("loadLinks").onclick=loadLinks;
