# Skill pihak ketiga

Skill di `.claude/skills/` disalin apa adanya dari repo berikut. Jangan diedit
di sini; kalau perlu versi baru, salin ulang dari sumbernya.

| Skill | Sumber | Commit | Lisensi |
|---|---|---|---|
| `grill-me`, `grilling`, `tdd`, `diagnosing-bugs` | github.com/mattpocock/skills | `5863806` | MIT (`.claude/LICENSE-mattpocock-skills`) |
| `spec-driven-development`, `security-and-hardening`, `code-review-and-quality`, `shipping-and-launch` + `.claude/references/` | github.com/addyosmani/agent-skills | `301b02b` | MIT (`.claude/LICENSE-addyosmani-agent-skills`) |

## Elephant-Goldfish Model (Google)

Tidak disalin ke repo karena berbentuk plugin (skill + agen reviewer yang saling
bergantung). Pasang sekali per mesin:

```sh
claude plugin marketplace add google/elephant-goldfish-model
claude plugin install egm@egm
```

Sumber: github.com/google/elephant-goldfish-model (Apache 2.0, dicek pada commit `8414530`).
