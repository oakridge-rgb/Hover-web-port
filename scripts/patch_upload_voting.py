#!/usr/bin/env python3
"""Add the FATE VOTE SYSTEM (hard session gate + Firestore poll) to the
user-uploaded games.html (FATE V6 with Cloudflare proxy routing).

Three patches, all anchor-based and idempotence-guarded:
  1. "Votes" chip button in the quick-actions row (after Shortcuts)
  2. Gate hooks: openGame/openGameInNewTab route through FateVote.needsGate()
     (originals renamed to openGameReal / openGameInNewTabReal)
  3. Full vote system block (style + gate overlay + results overlay + module
     script with the nicexat-d7c56 Firebase config and test poll) before </body>

Result -> /home/z/my-project/download/games.html
"""
import sys

SRC_UPLOAD = "/home/z/my-project/upload/games.html"
SRC_DELIVERED = "/home/z/my-project/download/site/games.html"
OUT = "/home/z/my-project/download/games.html"

html = open(SRC_UPLOAD, encoding="utf-8").read()
if "FATE VOTE SYSTEM" in html:
    print("ERROR: uploaded file already contains the vote system"); sys.exit(1)

# ---- extract the finished vote block from the delivered version ----
full = open(SRC_DELIVERED, encoding="utf-8").read()
m1 = full.find("<!-- ===== FATE VOTE SYSTEM")
m2 = full.find("<!-- ===== END FATE VOTE SYSTEM ===== -->")
if m1 < 0 or m2 < 0:
    print("ERROR: vote block markers not found in delivered games.html"); sys.exit(1)
vote_block = full[m1:m2 + len("<!-- ===== END FATE VOTE SYSTEM ===== -->")]
assert 'apiKey: "AIzaSyCBEtckpxwQLbFKtFhDb33ZtIEgRi9X4NQ"' in vote_block
assert "DEFAULT_POLL = { question: 'test'" in vote_block
print("[extract] vote block: %d chars (config + test poll included)" % len(vote_block))

def patch(text, old, new, label):
    if text.count(old) != 1:
        print("ERROR: anchor for %s found %d times" % (label, text.count(old))); sys.exit(1)
    print("[patch] %s OK" % label)
    return text.replace(old, new)

# ---- 1. Votes chip in quick-actions (after Shortcuts button) ----
html = patch(
    html,
    """      Shortcuts
    </button>
  </div>""",
    """      Shortcuts
    </button>
    <button class="q-btn" onclick="if(window.FateVote)FateVote.openResults()" title="Live vote results">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.9v14h-2.9V5zm5.6 8H19v6h-2.9v-6zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>
      Votes <span class="fv-chip-badge" id="fvChipCount">0</span>
    </button>
  </div>""",
    "votes chip",
)

# ---- 2. gate hooks on the play flow ----
html = patch(
    html,
    """function openGame(id){
  const g = allGames.find(x=>x.id===id);""",
    """function openGame(id){
  if(window.FateVote && FateVote.needsGate()){
    FateVote.hold(function(){ openGameReal(id); });
    return;
  }
  openGameReal(id);
}
function openGameReal(id){
  const g = allGames.find(x=>x.id===id);""",
    "openGame gate hook",
)

html = patch(
    html,
    """function openGameInNewTab(){
  if(currentGame){""",
    """function openGameInNewTab(){
  if(window.FateVote && FateVote.needsGate()){
    FateVote.hold(function(){ openGameInNewTabReal(); });
    return;
  }
  openGameInNewTabReal();
}
function openGameInNewTabReal(){
  if(currentGame){""",
    "openGameInNewTab gate hook",
)

# ---- 3. vote system block before </body> ----
html = patch(
    html,
    """</script>
</body>
</html>""",
    """</script>

""" + vote_block + """

</body>
</html>""",
    "vote system block",
)

open(OUT, "w", encoding="utf-8").write(html)
print("[done] wrote %s (%d lines)" % (OUT, html.count("\n") + 1))
