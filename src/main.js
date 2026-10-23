// main bootstrap
window.G = window.G || {};
(function(){
  const G = window.G;
  // overlay button
  document.getElementById("ovbtn").addEventListener("click", () => {
    G.hideOverlay();
    if (G.state === "DEFEAT" || G.state === "VICTORY") {
      G.state = "MENU";
    }
  });
  // start loop
  document.getElementById("startBtn").addEventListener("click", () => {
    if (G.state === "MENU") { G.startGame(); document.getElementById("startBtn").style.display="none"; }
  });
  // show/hide start btn based on state
  setInterval(()=>{ const b=document.getElementById("startBtn"); if(b) b.style.display = (G.state==="MENU")?"block":"none"; }, 200);
  if (location.search.includes("autostart")) {
    setTimeout(()=>{ if (G.state==="MENU") G.startGame(); }, 500);
  }
  requestAnimationFrame(G.loop);
})();
