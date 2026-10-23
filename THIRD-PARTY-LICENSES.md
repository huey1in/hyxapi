# Third-Party Licenses

This file summarizes direct third-party dependencies used by this project.
Keep it with distributed binaries and frontend bundles.

Scope: direct dependencies from the root, `relaykit/`, and `tokenkit/` Go modules,
and `web/package.json`. Versions reflect the resolved
Go module graphs and committed Bun locks. Development and test dependencies are
listed separately from production dependencies. Transitive dependencies require
an additional inventory before a final external release.

## Dependency Inventory

| Area | Scope | Ecosystem | Dependency | Version | License |
| --- | --- | --- | --- | --- | --- |
| backend | production | Go | `github.com/abema/go-mp4` | `v1.4.1` | MIT |
| backend | test | Go | `github.com/alicebob/miniredis/v2` | `v2.38.0` | MIT |
| backend | production | Go | `github.com/andybalholm/brotli` | `v1.2.0` | MIT |
| backend | production | Go | `github.com/anknown/ahocorasick` | `v0.0.0-20190904063843-d75dbd5169c0` | MIT |
| backend | production | Go | `github.com/aws/aws-sdk-go-v2` | `v1.41.5` | Apache-2.0 |
| backend | test | Go | `github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream` | `v1.7.8` | Apache-2.0 |
| backend | production | Go | `github.com/aws/aws-sdk-go-v2/credentials` | `v1.19.10` | Apache-2.0 |
| backend | production | Go | `github.com/aws/aws-sdk-go-v2/service/bedrockruntime` | `v1.50.4` | Apache-2.0 |
| backend | production | Go | `github.com/aws/smithy-go` | `v1.24.2` | Apache-2.0 |
| backend | production | Go | `github.com/Azure/go-ntlmssp` | `v0.1.1` | MIT |
| backend | production | Go | `github.com/bytedance/gopkg` | `v0.1.3` | Apache-2.0 |
| backend | production | Go | `github.com/Calcium-Ion/go-epay` | `v0.0.5` | MIT |
| backend | production | Go | `github.com/Calcium-Ion/moejs` | `v0.1.0-alpha.7` | Apache-2.0 |
| backend | production | Go | `github.com/casbin/casbin/v2` | `v2.135.0` | Apache-2.0 |
| backend | production | Go | `github.com/ClickHouse/clickhouse-go/v2` | `v2.46.0` | Apache-2.0 |
| backend | production | Go | `github.com/coreos/go-oidc/v3` | `v3.21.0` | Apache-2.0 |
| backend | production | Go | `github.com/expr-lang/expr` | `v1.17.8` | MIT |
| backend | test | Go | `github.com/fxamacker/cbor/v2` | `v2.9.0` | MIT |
| backend | production | Go | `github.com/gin-contrib/cors` | `v1.7.2` | MIT |
| backend | production | Go | `github.com/gin-contrib/gzip` | `v0.0.6` | MIT |
| backend | production | Go | `github.com/gin-contrib/static` | `v0.0.1` | MIT |
| backend | production | Go | `github.com/gin-gonic/gin` | `v1.9.1` | MIT |
| backend | production | Go | `github.com/glebarez/go-sqlite` | `v1.21.2` | BSD-3-Clause |
| backend | production | Go | `github.com/glebarez/sqlite` | `v1.11.0` | MIT |
| backend | production | Go | `github.com/go-audio/aiff` | `v1.1.0` | Apache-2.0 |
| backend | production | Go | `github.com/go-audio/wav` | `v1.1.0` | Apache-2.0 |
| backend | production | Go | `github.com/go-playground/validator/v10` | `v10.20.0` | MIT |
| backend | production | Go | `github.com/go-redis/redis/v8` | `v8.11.5` | BSD-2-Clause |
| backend | production | Go | `github.com/go-sql-driver/mysql` | `v1.7.0` | MPL-2.0 |
| backend | production | Go | `github.com/go-webauthn/webauthn` | `v0.14.0` | BSD-3-Clause |
| backend | production | Go | `github.com/golang-jwt/jwt/v5` | `v5.3.0` | MIT |
| backend | production | Go | `github.com/google/uuid` | `v1.6.0` | BSD-3-Clause |
| backend | production | Go | `github.com/gorilla/websocket` | `v1.5.0` | BSD-2-Clause |
| backend | production | Go | `github.com/grafana/pyroscope-go` | `v1.2.7` | Apache-2.0 |
| backend | production | Go | `github.com/jackc/pgx/v5` | `v5.9.0` | MIT |
| backend | production | Go | `github.com/jfreymuth/oggvorbis` | `v1.0.5` | MIT |
| backend | production | Go | `github.com/jinzhu/copier` | `v0.4.0` | MIT |
| backend | production | Go | `github.com/joho/godotenv` | `v1.5.1` | MIT |
| backend | test | Go | `github.com/json-iterator/go` | `v1.1.12` | MIT |
| backend | production | Go | `github.com/mewkiz/flac` | `v1.0.13` | Unlicense |
| backend | production | Go | `github.com/nicksnyder/go-i18n/v2` | `v2.6.1` | MIT |
| backend | test | Go | `github.com/openai/openai-go` | `v1.12.0` | Apache-2.0 |
| backend | production | Go | `github.com/pkg/errors` | `v0.9.1` | BSD-2-Clause |
| backend | production | Go | `github.com/pquerna/otp` | `v1.5.0` | Apache-2.0 |
| backend | production | Go | `github.com/prometheus/common` | `v0.62.0` | Apache-2.0 |
| backend | production | Go | `github.com/samber/hot` | `v0.11.0` | MIT |
| backend | production | Go | `github.com/samber/lo` | `v1.53.0` | MIT |
| backend | production | Go | `github.com/shirou/gopsutil` | `v3.21.11+incompatible` | BSD-3-Clause |
| backend | production | Go | `github.com/shopspring/decimal` | `v1.4.0` | MIT |
| backend | test | Go | `github.com/stretchr/testify` | `v1.12.1` | MIT |
| backend | production | Go | `github.com/stripe/stripe-go/v81` | `v81.4.0` | MIT |
| backend | production | Go | `github.com/tcolgate/mp3` | `v0.0.0-20170426193717-e79c5a46d300` | MIT |
| backend | production | Go | `github.com/thanhpk/randstr` | `v1.0.6` | MIT |
| backend | production | Go | `github.com/tidwall/gjson` | `v1.19.0` | MIT |
| backend | production | Go | `github.com/tidwall/sjson` | `v1.2.5` | MIT |
| backend | production | Go | `github.com/waffo-com/waffo-go` | `v1.3.2` | MIT |
| backend | production | Go | `github.com/waffo-com/waffo-pancake-sdk-go` | `v0.3.1` | MIT |
| backend | production | Go | `github.com/yapingcat/gomedia` | `v0.0.0-20240906162731-17feea57090c` | MIT |
| backend | production | Go | `golang.org/x/crypto` | `v0.48.0` | BSD-3-Clause |
| backend | production | Go | `golang.org/x/image` | `v0.38.0` | BSD-3-Clause |
| backend | production | Go | `golang.org/x/net` | `v0.50.0` | BSD-3-Clause |
| backend | production | Go | `golang.org/x/oauth2` | `v0.36.0` | BSD-3-Clause |
| backend | production | Go | `golang.org/x/sync` | `v0.20.0` | BSD-3-Clause |
| backend | production | Go | `golang.org/x/sys` | `v0.41.0` | BSD-3-Clause |
| backend | production | Go | `golang.org/x/text` | `v0.35.0` | BSD-3-Clause |
| backend | production | Go | `gopkg.in/yaml.v3` | `v3.0.1` | Apache-2.0 OR MIT |
| backend | production | Go | `gorm.io/driver/clickhouse` | `v0.6.0` | MIT |
| backend | production | Go | `gorm.io/driver/mysql` | `v1.5.7` | MIT |
| backend | production | Go | `gorm.io/driver/postgres` | `v1.5.9` | MIT |
| backend | production | Go | `gorm.io/gorm` | `v1.25.12` | MIT |
| relaykit | production | Go | `github.com/google/uuid` | `v1.6.0` | BSD-3-Clause |
| relaykit | production | Go | `github.com/samber/lo` | `v1.53.0` | MIT |
| relaykit | test | Go | `github.com/stretchr/testify` | `v1.11.1` | MIT |
| relaykit | production | Go | `github.com/tidwall/gjson` | `v1.19.0` | MIT |
| relaykit | production | Go | `github.com/tidwall/sjson` | `v1.2.5` | MIT |
| tokenkit | test | Go | `github.com/stretchr/testify` | `v1.11.1` | MIT |
| tokenkit | production | Go | `github.com/tiktoken-go/tokenizer` | `v0.8.1` | MIT |
| web | production | npm | `@tanstack/react-query` | `5.104.4` | MIT |
| web | production | npm | `axios` | `1.16.0` | MIT |
| web | production | npm | `clsx` | `2.1.1` | MIT |
| web | production | npm | `highlight.js` | `11.11.1` | BSD-3-Clause |
| web | production | npm | `i18next` | `23.16.8` | MIT |
| web | production | npm | `i18next-browser-languagedetector` | `7.2.2` | MIT |
| web | production | npm | `katex` | `0.16.45` | MIT |
| web | production | npm | `lucide-react` | `0.511.0` | ISC |
| web | production | npm | `node-forge` | `1.4.0` | (BSD-3-Clause OR GPL-2.0) |
| web | production | npm | `prismjs` | `1.30.0` | MIT |
| web | production | npm | `qrcode.react` | `4.2.0` | ISC |
| web | production | npm | `react` | `19.3.1` | MIT |
| web | production | npm | `react-dom` | `19.3.1` | MIT |
| web | production | npm | `react-i18next` | `13.5.0` | MIT |
| web | production | npm | `react-markdown` | `10.1.0` | MIT |
| web | production | npm | `react-router-dom` | `6.30.3` | MIT |
| web | production | npm | `rehype-highlight` | `7.0.2` | MIT |
| web | production | npm | `rehype-katex` | `7.0.1` | MIT |
| web | production | npm | `remark-breaks` | `4.0.0` | MIT |
| web | production | npm | `remark-gfm` | `4.0.1` | MIT |
| web | production | npm | `remark-math` | `6.0.0` | MIT |
| web | production | npm | `zod` | `4.6.7` | MIT |
| web | production | npm | `zustand` | `5.0.15` | MIT |
| web | development | npm | `@rsbuild/core` | `2.2.13` | MIT |
| web | development | npm | `@rsbuild/plugin-react` | `2.1.1` | MIT |
| web | development | npm | `@rsbuild/plugin-tailwindcss` | `2.0.3` | MIT |
| web | development | npm | `@storybook/react` | `10.6.2` | MIT |
| web | development | npm | `@types/node` | `24.19.2` | MIT |
| web | development | npm | `@types/node-forge` | `1.3.14` | MIT |
| web | development | npm | `@types/prismjs` | `1.26.6` | MIT |
| web | development | npm | `@types/react` | `19.3.0` | MIT |
| web | development | npm | `@types/react-dom` | `19.3.0` | MIT |
| web | development | npm | `esbuild` | `0.28.2` | MIT |
| web | development | npm | `storybook` | `10.6.2` | MIT |
| web | development | npm | `storybook-react-rsbuild` | `3.6.1` | MIT |
| web | development | npm | `tailwindcss` | `4.3.3` | MIT |
| web | development | npm | `typescript` | `6.0.3` | Apache-2.0 |

## License Texts

### Apache-2.0

Apache License
Version 2.0, January 2004
https://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at:

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.

### Apache-2.0 OR MIT

Dual-licensed components may be used under Apache-2.0 or MIT. Both standard license texts are included below.

Apache License
Version 2.0, January 2004
https://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License"); you may not
use this file except in compliance with the License. You may obtain a copy of
the License at:

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
License for the specific language governing permissions and limitations under
the License.

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### BSD-2-Clause

BSD 2-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### BSD-3-Clause

BSD 3-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

### ISC

ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

### MIT

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### MPL-2.0

Mozilla Public License 2.0
https://mozilla.org/MPL/2.0/

The source code of the MPL-covered files is available from the upstream project at https://github.com/go-sql-driver/mysql.

### OFL-1.1

SIL Open Font License 1.1

The font dependency listed under OFL-1.1 is licensed under the SIL Open Font
License, Version 1.1. The full license text is available at:
https://openfontlicense.org/open-font-license-official-text/

When distributing font files, preserve the OFL license text, copyright notices,
and reserved font name restrictions supplied by the upstream font project.

### Unlicense

The Unlicense

This is free and unencumbered software released into the public domain.
Anyone is free to copy, modify, publish, use, compile, sell, or distribute
this software, either in source code form or as a compiled binary, for any
purpose, commercial or non-commercial, and by any means.

For more information, please refer to https://unlicense.org/
