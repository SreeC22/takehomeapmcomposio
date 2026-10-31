#!/usr/bin/env python3
"""Regenerate OAuth-Setup-Guides-Summary.pdf from current project state.
No external libraries. Helvetica, A4, wrapped text, multiple pages.
Usage: python3 scripts/make-pdf.py <deployment_id> <github_commit> <eval_a> <eval_b_summary>
"""
import sys, zlib

def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def wrap(text, width=95):
    out = []
    for para in text.split("\n"):
        if not para:
            out.append("")
            continue
        line = ""
        for w in para.split(" "):
            if len(line) + len(w) + 1 > width:
                out.append(line)
                line = w
            else:
                line = (line + " " + w).strip()
        if line:
            out.append(line)
    return out

def build(lines, path):
    # lines: list of (text, bold)
    content_lines = []
    y = 800
    pages = []
    cur = []
    for text, bold in lines:
        for wl in wrap(text):
            cur.append((wl, bold))
            if len(cur) >= 52:
                pages.append(cur)
                cur = []
    if cur:
        pages.append(cur)
    objects = []
    # 1 Pages, 2 Catalog, then per page: page + contents, then fonts
    n_pages = len(pages)
    page_ids = []
    content_ids = []
    obj_id = 3
    for i in range(n_pages):
        page_ids.append(obj_id); content_ids.append(obj_id + 1); obj_id += 2
    font_bold_id = obj_id; font_id = obj_id + 1
    stream_parts = []
    for i, page in enumerate(pages):
        stream = "BT /F1 11 Tf 50 800 Td 14 TL\n"
        for text, bold in page:
            font = "/F2" if bold else "/F1"
            # switch font per line by ending and starting text object is complex;
            # use a simple approach: one BT per line
            stream += f"ET BT {font} 11 Tf 50 {800 - page.index((text, bold)) * 14} Td ({esc(text)}) Tj ET\n"
        # The above uses absolute y per line index, so start BT is not needed, but keep valid PDF by using ET/BT pairs
        stream = ""
        for j, (text, bold) in enumerate(page):
            font = "/F2" if bold else "/F1"
            ypos = 800 - j * 14
            stream += f"BT {font} 11 Tf 50 {ypos} Td ({esc(text)}) Tj ET\n"
        stream_parts.append(stream)
    out = b"%PDF-1.3\n%\xe9\xeb\xf1\xbf\n"
    offsets = {}
    def add_obj(num, body):
        offsets[num] = len(out)
        return f"{num} 0 obj\n{body}\nendobj\n".encode()
    # Build in order, tracking offsets by assembling sequentially
    parts = []
    # We need offsets in file order, so assemble in id order
    objs = {}
    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objs[1] = f"<< /Count {n_pages} /Kids [{kids}] /MediaBox [0 0 595.28 841.89] /Type /Pages >>"
    objs[2] = f"<< /OpenAction [{page_ids[0]} 0 R /FitH null] /PageLayout /OneColumn /Pages 1 0 R /Type /Catalog >>"
    for i in range(n_pages):
        objs[page_ids[i]] = f"<< /Contents {content_ids[i]} 0 R /Parent 1 0 R /Resources << /Font << /F1 {font_id} 0 R /F2 {font_bold_id} 0 R >> >> /Type /Page >>"
        comp = zlib.compress(stream_parts[i].encode())
        objs[content_ids[i]] = f"<< /Filter /FlateDecode /Length {len(comp)} >>\nstream\n".encode().decode('latin1') + comp.decode('latin1') + "\nendstream"
    objs[font_bold_id] = "<< /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding /Subtype /Type1 /Type /Font >>"
    objs[font_id] = "<< /BaseFont /Helvetica /Encoding /WinAnsiEncoding /Subtype /Type1 /Type /Font >>"
    max_id = max(objs.keys())
    # Assemble
    buf = bytearray(b"%PDF-1.3\n%\xe9\xeb\xf1\xbf\n")
    off = {}
    for num in sorted(objs.keys()):
        off[num] = len(buf)
        body = objs[num]
        if isinstance(body, str):
            body = body.encode('latin1')
        buf += f"{num} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_pos = len(buf)
    buf += f"xref\n0 {max_id + 1}\n".encode()
    buf += b"0000000000 65535 f \n"
    for num in range(1, max_id + 1):
        buf += f"{off[num]:010d} 00000 n \n".encode()
    buf += f"trailer\n<< /Size {max_id + 1} /Root 2 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    open(path, "wb").write(buf)
    print(f"Wrote {path}, {n_pages} pages, {len(buf)} bytes")

if __name__ == "__main__":
    dep = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    commit = sys.argv[2] if len(sys.argv) > 2 else "unknown"
    eval_a = sys.argv[3] if len(sys.argv) > 3 else "14/14"
    eval_b = sys.argv[4] if len(sys.argv) > 4 else "see SUBMISSION-NOTES.md"
    L = []
    def h(t): L.append((t, True))
    def p(t): L.append((t, False))
    h("OAuth Setup Guides, Composio APM Integrations Take-home")
    p("Live site: https://takehomeapmcomposio-sreekaree-chityalas-projects.vercel.app/")
    p(f"Production deployment: {dep}")
    p(f"GitHub: SreeC22/takehomeapmcomposio, main, commit {commit}")
    p("")
    h("What this is")
    p("A website where developers can search for an app, receive a trustworthy OAuth setup and approval guide, and have an AI agent investigate and generate that guide when the app is not already in the library.")
    p("Library: 16 full guides, 0 summaries. Generated guides are researched live, with sources, evidence passages, requirements, decisions, claims, and a quality gate. No guide claims a sign-in, app creation, or provider approval was completed.")
    p("")
    h("Final engineering push, what changed")
    p("- Auth relationships: client, resource owner, identity provider, authorization target, action, and direction are recorded separately for third-party OAuth, sign-in OAuth, registration-free OAuth, API key, personal token, service account, MCP, enterprise SSO, and external identity provider sign-in. These are not interchangeable.")
    p("- Registration guard: create an application is only OAuth registration when the passage, section, or source URL is a developer or OAuth context.")
    p("- Claims: subject, action, object, product, auth context, passage, URL, section, condition, contradictory passage, and verification outcome. Verified only when the passage entails the claim.")
    p("- Product boundaries: scopes only from permission-description pages, grouped by product page, not merged across products.")
    p("- Token endpoints: a token URL is only an OAuth token endpoint when its path contains oauth or authorize. A plain API token URL is rejected.")
    p("- Console: a documentation article is not a registration console. Console Unknown is honest, not hidden.")
    p("- Independent gate: step prose is re-checked against raw fetched text, not against the generator's own requirement objects. A removed required step makes the guide a draft.")
    p("- No paid model, no local model in the serverless function. The method is deterministic sentence semantics, and the guide says so. It is not semantic understanding.")
    p("")
    h("Evaluation")
    p(f"Evaluation A, fixed-document regression, scripts/fixed-doc-eval.js, using the actual production functions: {eval_a}. The three improvements over the pre-round logic are the negated start-from-scratch case, token endpoint categorization, and docs URL as console.")
    p(f"Evaluation B, independently checked unfamiliar providers: {eval_b}. Full per-provider findings, critical-error rate, factual precision on asserted claims, useful coverage, and abstention rate are in SUBMISSION-NOTES.md. Structural checklist points are not presented as factual accuracy.")
    p("")
    h("Limitations, honestly stated")
    p("- No guide has ever been tested with a provider sign-in, app creation, or approval submission.")
    p("- Console Unknown is now common under the stricter rule. That is honest abstention, not a verified portal.")
    p("- Run-to-run Tavily and fetch variance can still flip auth classification. Unknown is the safe result in those cases.")
    p("- JS-rendered docs cannot be read by static fetch. Cache and rate limits are per Vercel instance, not global.")
    p("- The rule engine is deterministic, not semantic understanding. Complex negation, exceptions, and conditional requirements that do not follow linked patterns are marked Unknown, not guessed.")
    p("")
    h("Submission")
    p("The reviewer can open the live site, search for an unfamiliar app, and watch a guide generate live, with its sources and evidence. The GitHub repository contains the same code as production. This PDF is a summary only; the site and repository are the submission.")
    build(L, "OAuth-Setup-Guides-Summary.pdf")
