#!/usr/bin/env python3
"""Create the 'test' poll in project nicexat-d7c56 via Firestore REST API.

Tries anonymous sign-in with the web apiKey to get an idToken, then PATCHes
documents/polls/current (set semantics: create or full replace).
Falls back to an unauthenticated write in case the DB is still in test mode.
"""
import json
import urllib.request
import urllib.error

API_KEY = "AIzaSyCBEtckpxwQLbFKtFhDb33ZtIEgRi9X4NQ"
PROJECT = "nicexat-d7c56"
BASE = "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents" % PROJECT

POLL = {
    "question": "test",
    "options": ["Yes", "No", "Maybe", "IDK"],
}
UPDATED_AT = "t2026-11-13a"  # round = 'f' + str(updatedAt) -> 'ft2026-11-13a'


def req(url, data=None, token=None, method=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}
    except Exception as e:
        return -1, {"raw": str(e)}


def poll_doc():
    return {"fields": {
        "question": {"stringValue": POLL["question"]},
        "options": {"arrayValue": {"values": [{"stringValue": o} for o in POLL["options"]]}},
        "active": {"booleanValue": True},
        "updatedAt": {"stringValue": UPDATED_AT},
    }}


def main():
    # 1) anonymous sign-in (same provider the site uses)
    st, anon = req(
        "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY,
        {"returnSecureToken": True},
    )
    token = anon.get("idToken")
    if token:
        print("[1] anonymous sign-in OK ->", anon.get("kind", "idToken received"))
    else:
        print("[1] anonymous sign-in failed:", st, json.dumps(anon)[:300])
        print("    (Anonymous provider may be disabled; will try unauthenticated write)")

    # 2) write polls/current
    st2, res2 = req(BASE + "/polls/current", poll_doc(), token, method="PATCH")
    print("[2] write polls/current:", st2)
    if st2 not in (200, 201):
        print("    error:", json.dumps(res2)[:400])
        print("    -> poll NOT created. Check the message above:")
        print("       NOT_FOUND = Firestore DB missing (create it in console)")
        print("       PERMISSION_DENIED = rules block writes (create doc manually in console)")
        return 1

    # 3) read back + peek voters
    st3, res3 = req(BASE + "/polls/current", token=token)
    print("[3] read back:", st3, json.dumps(res3.get("fields", res3))[:400])
    st4, res4 = req(BASE + "/polls/current/voters?pageSize=5&key=" + API_KEY)
    docs = res4.get("documents", [])
    print("[4] voters:", st4, "-", len(docs), "ballot(s) so far")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
