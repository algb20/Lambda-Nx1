# The working list — 177 distinct requests

Recovered 2026-08-15 from the complete session record. Each row links to the
verbatim text; the summary is a **pointer, never a substitute**.

`repeats` is how many times the same ask had to be given again — the direct
measure of what was being ignored.


## Where the 150 stand, after reconciliation

Run `python3 scripts/reconcile-ledger.py` to regenerate. The script gathers
evidence mechanically and **never closes a request** — a keyword hit is a lead,
not a delivery.

| Status | Count | Means |
|---|---|---|
| `answered` | 38 | A question or a continuation. Answered in conversation; no artifact expected, and none should be looked for. |
| `needs-check` | 76 | Something in the tree matches. A person must open the request and confirm it is actually satisfied. |
| `open` | 36 | No trace anywhere. |

**The `open` 36 are not all dropped work.** Reading them, most are setup
troubleshooting from 6–7 August — Supabase pooler settings, Vercel environment
variables, "where do I find the link" — resolved live at the time and leaving no
commit by their nature. The classifier cannot tell those from a real gap, and
guessing would defeat the point of the ledger.

The ones that **are** genuine standing work, named rather than buried:

| ID | Still owed |
|---|---|
| R018, R024 | Keep the original design; make it worthy of a first-rate product |
| R032 | Bring your own ideas and inventions — do not only build what I hand you |
| R052 | Stop the Valet project without deleting it |
| R096, R106, R107 | Finish everything remaining, to the last point |
| R151 | Sort and arrange the page properly |
| R152 | Auto-publishing must run **continuously**, not sit static |
| R155 | The research is incomplete — 29 platforms unmeasured |
| R159 | `/monitor` is an empty page to a signed-out visitor |
| R160 | Every route takes ~13.4s to settle |
| R178 | 2026-08-20 | `security` | 3 | `done` | **قاعدة دائمة في كل مشاريعنا:** الأسرار والمفاتيح تُحفظ في مكان لا يصله أحد غير المالك — ولا المساعدون ولا أي مطوّر يُضاف للمستودع |
| R179 | 2026-08-20 | `gateways` | | `open` | ابحث عن **كل** أنواع البوّابات وتخصّصاتها ومجالاتها، وأضفها بكل مميزاتها وإعداداتها وتقنياتها |
| R180 | 2026-08-20 | `gateways` | | `done` | كل البورصات والأسهم بكل أنواعها |
| R181 | 2026-08-20 | `gateways` | | `done` | اقتصادات الشركات والدول — أكبر وأهم الشركات: شراكاتها، أعمالها، معلوماتها، أسهمها |
| R182 | 2026-08-20 | `gateways` | | `done` | بوّابة تُظهر **تصنيف** الشركات — ترتيب أكبر ٢٥ مُودِعًا بإجمالي الأصول من إطارات XBRL (٦١١٠ شركة)، والمقياس مُسمّى لا مُضمَر |
| R183 | 2026-08-20 | `gateways` | | `done` | شركات ومصانع الدول والقطاع الخاص |
| R184 | 2026-08-20 | `gateways` | | `open` | آليّة تعمل **تلقائيًا** لكل البوّابات |
| R185 | 2026-08-20 | `gateways` | | `done` | بوّابة **العملات الرقمية والبلوكشين** — `crypto`: أيّ أصل من **١٨٬٦١٠** بسجلّه الكامل (السعر، العرض مقابل السقف، البُعد عن القمّة، السلاسل التي يعمل عليها)، وأخباره من **٧ ناشرين** أربعة منهم الشبكات نفسها (Pi Core Team · Ethereum Foundation · Solana · Bitcoin Optech) |
| R186 | 2026-08-20 | `gateways` | | `done` | بوّابة **المعادن والثروات** — `resources`: ١٨ سلسلة أسعار من صندوق النقد عبر FRED (نحاس، ألمنيوم، نيكل، زنك، رصاص، قصدير، حديد، يورانيوم، فحم، غاز + غذاء + ٣ مؤشرات) |
| R187 | 2026-08-20 | `gateways` | | `done` | **`docs/GATEWAY-MAP.md`** — الخريطة المبحوثة الكاملة: عشرون تخصّصًا من مرجعنا، خمسة خارج النطاق بحكم الميثاق، **٣٢ بوّابة** موزّعة عليها، وخمس فجوات لكلٍّ منها سلطة مسمّاة وحالة **مُتحقَّق منها حيًّا** — بما فيها الفجوات التي **لا طريق مجّاني لها** (البراءات، الحرمان من التعاقد) مسجّلة بدل إخفائها |
| R188 | 2026-08-20 | `gateways` | | `done` | بوّابة `officials` — خطب محافظي البنوك المركزية بنصّها من BIS، مجمّعة لكل متحدّث. **أفعال المنصب العامة فقط**، لا حياة خاصة (§3) |
| R189 | 2026-08-20 | `gateways` | | `open` | البوّابات يجب أن **تتطوّر تلقائيًا** |
| R190 | 2026-08-20 | `globe` | | `open` | صفحة الكرة تُرتَّب وتحوي **كل** البوّابات — البوّابات الآن ٢٦ في ٧ عائلات على `/intelligence`؛ يبقى ربطها بالكرة |
| R191 | 2026-08-20 | `gateways` | | `done` | **٧ بوّابات جديدة**: المحاكم · التنظيم · المسؤولون · المعادن · شبكة الكهرباء · طقس الفضاء · الأجسام المدارية — كلها من الجهة الأصلية، بلا مفاتيح، ومُختبرة حيّة |
| R192 | 2026-08-20 | `gateways` | 2 | `done` | التطبيق كله يتحدّث عن الطقس والزلازل — اجمع كل المتشابه في **بوّابة واحدة** |
| R193 | 2026-08-20 | `design` | | `done` | **التاريخ:** «قبل ساعة» وهو خبر من أيام. ضع التاريخ الأصلي بتوقيت المنطقة، والنسبي حتى يوم واحد ثم التاريخ فقط |
| R194 | 2026-08-20 | `auth` | 2 | `done` | الدخول باسم مستخدم Pi فقط وتلقائيًا — لأن Pi عندها KYC حقيقي |
| R195 | 2026-08-20 | `auth` | 2 | `done` | خارج Pi: الدخول بالبريد + رسالة كود لإنشاء كلمة السر |
| R196 | 2026-08-20 | `auth` | 2 | `done` | اسم مستخدم يختاره المستخدم |
| R197 | 2026-08-20 | `auth` | | `done` | **الاسم الكامل** عند التسجيل، ويظهر للآخرين اسم المستخدم فقط + رمز **عين** يبدّل إظهار/إخفاء الاسم الحقيقي بكل ضغطة |
| R198 | 2026-08-20 | `i18n` | 2 | `done` | ترجمة جوجل لكل اللغات في التطبيق |
| R199 | 2026-08-20 | `publishing` | 2 | `done` | النشر التلقائي **يعمل ويتجدّد**: ثلاث طرق مستقلّة — Netlify كل ٢٠ دقيقة، Vercel يوميًّا (سقف الخطّة)، و`lib/modules/self-drive.ts` بلا أيّ مجدول إطلاقًا. مُثبت حيًّا: قراءة صفحة فارغة نشرت ٦ تنبيهات NWS حقيقية خلال ١٠ ثوانٍ. ولا كلمة «AI» على أيّ منشور |
| R200 | 2026-08-20 | `osint` | | `open` | أدوات المصادر المفتوحة **وهمية ولا تعطي معلومات** — فعّلها وزوّدها بأقوى التقنيات |
| R201 | 2026-08-20 | `innovation` | 2 | `open` | أضف ابتكاراتك بكل مميزاتها وأدواتها، مفعّلة كليًا |
| R202 | 2026-08-20 | `competitors` | 3 | `done` | تصفّح واستعمل وجرّب التطبيقات الأخرى **كمستخدم إنسان حقيقي** — لا ادّعاء |
| R203 | 2026-08-20 | `deploy` | 2 | `done` | أرسل ملف zip بعد إنجاز كل ما سبق |
| R204 | 2026-08-20 | `general` | | `open` | **قاعدة:** كل نقطة أطلبها — ابحث عنها، طبّقها بأحدث وأقوى الطرق وبكل إعداداتها من **المرّة الأولى**، لا إضافة ثم عشرات التعديلات |
| R205 | 2026-08-20 | `deploy` | 2 | `done` | مُثبت هذه المرّة بالفعل: فُكّ الزيب في مجلّد نظيف، `npm install` ثم `npm run build` ثم `npm start` — الكرة تعمل (٢٤٨/٢٨٧٧ حدثًا حيًّا)، والبوّابات تعمل (١١ سجلًّا من NOAA)، بلا مفتاح ولا قاعدة بيانات. وأُضيفت صفحة `/setup` التي تُشخّص أيّ الأسباب الثلاثة يمنع النسخة من العمل |
| R206 | 2026-08-20 | `globe` | | `done` | إعدادات الكرة تُحفظ فعلًا — مُثبت في متصفّح حقيقي: فتح مربّع، الانتقال إلى الصفحة الرئيسية والعودة، والإعداد كما هو (`panels:["seismic"]`). يعمل بلا قاعدة بيانات أيضًا |
| R207 | 2026-08-20 | `globe` | | `done` | مربّع لكل صنف أسفل الخريطة: الأهمّ أوّلًا ثم الأحدث، مع المصدر ووقت الناشر نفسه ودرجة Admiralty وحالة التأكيد على كل سطر |
| R208 | 2026-08-20 | `globe` | | `done` | ثلاثة أحجام (مضغوط/عادي/عريض) + ترتيب المربّعات + ضغطة واحدة تفتح المربّع وتُلغي إخفاء الصنف معًا. وأُصلح لبس حقيقي وجدته أثناء التجربة: صفّان من الأزرار يحملان نفس الكلمات ويفعلان شيئين مختلفين — كلٌّ منهما يسمّي فعله الآن |
| R209 | 2026-08-20 | `design` | | `done` | **اختيار من ١ إلى ٥ بوّابات** يختارها المستخدم لتظهر في الصفحة الرئيسية |
| R210 | 2026-08-20 | `auth` | 3 | `done` | التسجيل بمعرّف Pi دون بريد يعمل، وأُصلح خلل جوهري: الكود كان يبني الاسم من `uid` (معرّف عشوائي ٣٦ حرفًا) لا من `username`، فكان **كل رائد يحصل على حساب بلا اسم إطلاقًا** بصمت. مُثبت حيًّا بمقلّد رسمي لواجهة Pi. يبقى اختبار داخل متصفّح Pi الحقيقي — لا نملكه هنا |
| R211 | 2026-08-20 | `data` | | `done` | مُثبت على PostgreSQL 16 حقيقي بترحيلات المستودع نفسها: ٢٣ جدولًا، بلا أخطاء. `/api/health?deep=1` يردّ «connected to PostgreSQL 16.13 in 27ms; all 23 tables present». دورة كاملة: تسجيل دخول Pi → كتابة الصفوف → جلسة → مطالبة بكلمة سر → دخول خارج Pi بنفس الحساب |
| R212 | 2026-08-20 | `gateways` | 2 | `open` | مصادر وبوّابات كثيرة لم تُذكر بعد — أين البحث والخبرة |
| R213 | 2026-08-20 | `gateways` | | `open` | كل ما يخصّ الاقتصاد والمال والاكتشافات والأبحاث والأخبار موجود ومرتّب |
| R214 | 2026-08-20 | `gateways` | | `done` | بوّابة `statements` — تسع جهات كلامها فعل (البيت الأبيض، الأمم المتّحدة، المفوّضية الأوروبية، الفدرالي، المركزي الأوروبي، الحكومة البريطانية، الوكالة الذرّية، الصحّة العالمية). مرتّبة بالأثر عبر `lib/analysis/impact.ts` مع **إظهار سبب كل ترتيب** لا رقمًا مجرّدًا. حيًّا: ١٣٠ سجلًّا في ٩ مجموعات |
| R215 | 2026-08-20 | `auth` | 1 | `done` | **داخل متصفّح Pi:** التسجيل باسم مستخدم Pi **فقط**. **خارجه:** بالبريد + كود تأكيد + استعادة كلمة السر. الفصل يكون بكشف البيئة لا بخيار المستخدم |
| R216 | 2026-08-20 | `auth` | 1 | `done` | **معرّف خاص لكل مستخدم** |
| R217 | 2026-08-20 | `deploy` | 1 | `open` | المشروع تطبيق داخل متصفّح Pi **و** موقع عام يُطلق فور الجاهزية — رتّبها باحترافية |
| R218 | 2026-08-20 | `globe` | 1 | `done` | **صفحة الخريطة: أخطاء ومعلومات خاطئة**، ومعلومات يجب حجبها عن العامّة |
| R219 | 2026-08-20 | `gateways` | 1 | `done` | الأخبار كلّها **طقس، قديمة، مكرّرة** — مزعج. اجمع الطقس والزلازل والبراكين والكوارث وكل الأحداث الطبيعية في **بوّابة واحدة** |
| R220 | 2026-08-20 | `news` | 1 | `open` | عند رصد **حدث كبير** يظهر وسط الأخبار في الجدول المخصّص بصفة **عاجل/مميّز** باحترافية |
| R221 | 2026-08-20 | `design` | 1 | `open` | **كل البوّابات والفئات** بتصميم «يحدث الآن» — تدفّق الأحداث والأخبار والمعلومات |
| R222 | 2026-08-20 | `design` | 1 | `open` | فئات تحتاج **أدوات ومميزات أكثر**؛ تصميم الأحداث والأخبار الحالي سيّئ |
| R223 | 2026-08-20 | `design` | 1 | `open` | اختيار الفئات: اعرض على المستخدم **كل** الفئات، و**زرّ واحد** يُظهرها كلّها ليختار — استغلال المساحة باحترافية |
| R224 | 2026-08-20 | `design` | 1 | `open` | أشياء كثيرة تعمل **بعشوائية**، وطريقة العرض، و**التاريخ والتوقيت مضلّل جدًّا** |
| R225 | 2026-08-20 | `markets` | 1 | `done` | **البورصات** (ISO 10383: ٢٬٢٩٣ بورصة/١٤٩ دولة مع LEI) + **بوّابة الإيداعات** (بحث نصّي كامل في كل إيداعات SEC، مصنّفة برموز الإفصاح). العملات الرقمية والأسهم والعقارات موجودة مسبقًا؛ يبقى دمجها في لوحة أسواق واحدة |
| R226 | 2026-08-20 | `gateways` | 1 | `done` | **ثلاث بوّابات جديدة**: `venues` (البورصات) · `filings` (الإيداعات) · `broadcasts` (البثوث) — المجموع ٣٠ بوّابة |
| R227 | 2026-08-20 | `innovation` | 1 | `open` | أين **الابتكار** وأين **الحلول الجديدة** |
| R228 | 2026-08-20 | `media` | 1 | `done` | **بوّابة البثوث** — ٦٢٬٦٩٤ محطة في ٢٤١ دولة و٦٤٩ لغة، بلا مفاتيح. والأهمّ: اكتشفت أن فحص الكتالوج الصحّي **متوقّف منذ ٢١٧ يومًا**، فبنيت التقدير على `clicktimestamp` — «فتحها مستمع قبل ٤ دقائق» بدل علَم قديم يُسمّى «حيّ» |
| R229 | 2026-08-20 | `general` | 1 | `open` | أنجز حتى **ما لم يُذكر** — لا تنتظر التذكير في كل مرّة |
| R230 | 2026-08-20 | `general` | 1 | `standing` | **قاعدة دائمة:** أيّ خطأ أو ثغرة تجدها — **أصلحها فورًا**، لا تنتظر ولا تؤجّل |

## Status vocabulary

| Status | Means | Requires |
|---|---|---|
| `unreconciled` | Recovered, not yet checked against the tree | — |
| `open` | Confirmed outstanding | — |
| `done` | Delivered | commit hash or file path |
| `blocked` | Cannot proceed | reason + what unblocks it |
| `declined` | Will not do | reason, **said out loud** |

| ID | Date | Theme | Repeats | Status | Request |
|---|---|---|---|---|---|
| R161 | 2026-08-15 | `design` | | `done` | **عطل حرج:** خطأ `insertBefore` عند الضغط — سببه المترجم يعدّل DOM تحت React. `lib/dom-resilience.ts` + ٩ اختبارات |
| R162 | 2026-08-15 | `design` | | `done` | لا تعرض معلومات/علامات غير لازمة على التطبيق — أُزيلت مفاتيح i18n الخام (`nav.feed` وأخواتها) وعدّاد البوّابات الخاطئ («ستة عشر» وهي ٢٦) |
| R163 | 2026-08-15 | `globe` | | `done` | صفحة الكرة: الخريطة أعلى الصفحة — `app/page.tsx`، بُدِّل ترتيب `GlobeView` و`StandingBriefPanel` |
| R164 | 2026-08-15 | `globe` | | `done` | لا تعرض في صفحة الكرة ما لا نحتاجه |
| R165 | 2026-08-15 | `globe` | | `done` | اجمع المتشابه: الفيضانات والزلازل وغيرها أشياء طبيعية — تُضمّ معًا كما هو أنسب |
| R166 | 2026-08-15 | `globe` | | `open` | طوّر الخريطة والكوكب إلى الأرقى |
| R167 | 2026-08-15 | `design` | | `done` | صنّف ورتّب وزِد التنوّع والفئات، والترتيب والفرز والعرض باحترافية — صنّف ورتّب — ٢٦ بوّابة في ٧ عائلات، وكل لوحة تصل مجمَّعة مع عدّاد لكل مجموعة واختيار متعدّد |
| R168 | 2026-08-15 | `data` | | `done` | **الأسهم** — Stooq مات (تحدّي بوت بـ200)؛ استُبدل بـFRED. S&P 500 · Dow · Nasdaq · VIX تعمل الآن |
| R169 | 2026-08-15 | `data` | | `done` | **العملات** (فوركس) — غير موجودة |
| R170 | 2026-08-15 | `data` | | `done` | **البلوكشين بكل التفاصيل والمعلومات والأسعار** |
| R171 | 2026-08-15 | `data` | | `done` | **العملات الرقمية بكل التفاصيل** |
| R172 | 2026-08-15 | `data` | | `done` | **العقارات** — بوّابة `property`: FRED (كيس-شيلر، سعر البيع الوسيط، بدء الإنشاءات، الرهن ٣٠ سنة، الشغور، المعروض) + Eurostat مؤشر أسعار المساكن + سجل الأراضي البريطاني. ٣٧ رقمًا، ٣٢ إقليمًا، حيّ |
| R173 | 2026-08-15 | `data` | | `done` | **أهم الشركات** — بوّابة `companies` من SEC EDGAR: الهوية والأسماء السابقة والقطاع والبورصات، الإيداعات الأخيرة، والأرقام كما صرّحت بها الشركة (XBRL) + ترتيب أكبر الشركات بميزانياتها |
| R174 | 2026-08-15 | `auth` | | `done` | **تسجيل تلقائي داخل Pi باسم مستخدم Pi فقط** — `app/api/auth/pi/route.ts`: لا نموذج، الاسم من Pi نفسها |
| R175 | 2026-08-15 | `auth` | | `done` | **خارج Pi:** كود ٦ أرقام (١٥ دقيقة، ٥ محاولات)، `lib/mail` عميل SMTP خاص بنا، ٤ مسارات، بلا تسريب لوجود الحساب |
| R176 | 2026-08-15 | `auth` | | `done` | اسم مستخدم يختاره المستخدم — `lib/auth/policy.ts` + النموذج، مساحة أسماء واحدة مع Pi |
| R177 | 2026-08-15 | `deploy` | | `done` | تنزيل ملف zip (حزمة التطبيق) — ملف zip — نسختان: كاملة (١٤٤٠ ك.ب) و`studio` تحت حدّ الميغابايت (٩٣٨ ك.ب)، `npm run package:studio` |
| R151 | 2026-08-15 | `design` | | `done` | فرز وترتيب الصفحة — الصفحة غير مرتّبة وتحتاج فرزًا وترتيبًا حقيقيًا |
| R152 | 2026-08-15 | `general` | | `open` | النشر التلقائي يجب أن يعمل **باستمرار** وليس مثبّتًا/ساكنًا |
| R153 | 2026-08-15 | `ai` | | `done` | وكلاء ذكاء دائمون — `.claude/agents/` (ledger-keeper, field-scout, source-hunter, user-walker) |
| R154 | 2026-08-15 | `general` | | `done` | فتح التطبيق حقيقيًا كمستخدم بكل الفئات — `scripts/walkthrough.ts`, `npm run walkthrough` |
| R155 | 2026-08-15 | `competitors` | | `done` | البحث لم يكتمل — ٢٩ منصّة لم تُقَس، ومواقع وثائقها مفتوحة ولم تُنقَّب |
| R156 | 2026-08-15 | `general` | 2 | `done` | **القاعدة الدائمة:** كل طلب يُسجَّل بتفاصيله حتى يُنفَّذ ثم يُنقل للمنفَّذ — `docs/ledger/` |
| R157 | 2026-08-15 | `general` | | `done` | استرجاع كل الطلبات من أول المشروع — ١٥٠ رسالة، ١٥١٠ تعليمة |
| R158 | 2026-08-15 | `design` | | `done` | **[walkthrough]** Vercel Analytics 404 في كل صفحة — أُزيل من `app/layout.tsx` |
| R159 | 2026-08-15 | `design` | | `done` | **[walkthrough]** `/monitor` يعرض ٤١٣ حرفًا وعنصرًا واحدًا لزائر غير مسجّل |
| R160 | 2026-08-15 | `perf` | | `open` | **[walkthrough]** كل مسار ~١٣٫٤ ثانية حتى سكون الشبكة |
| [R001](requests-recovered.md#r001) |2026-07-28|`sources`|| `needs-check` | [ملف] اريد بدا هذ المشروع بدقة وذات طفرة لامثيل ولا منافس له اولا حاليا التطبيق على شبكة الباي نوتورك وله مستودع اكملت مهام الشيكلست والتحققمن الدومين انتضر فقط قبول المي <br>**evidence:** sources → lib/engine/catalog; pi auth → lib/auth; monitoring → lib/alerts |
| [R002](requests-recovered.md#r002) |2026-07-28|`sources`|| `needs-check` | اريد بدا هذ المشروع بدقة وذات طفرة لامثيل ولا منافس له اولا حاليا التطبيق على شبكة الباي نوتورك وله مستودع اكملت مهام الشيكلست والتحققمن الدومين انتضر فقط قبول المينت ثم <br>**evidence:** sources → lib/engine/catalog; pi auth → lib/auth; monitoring → lib/alerts |
| [R003](requests-recovered.md#r003) |2026-07-28|`globe`|| `needs-check` | [ملف] نضرا للتوجه الرئيسي للتطبيق سازودك بملف يخدمنا في التوجه وايضا اعمل بحثق الخاص شامل لادوات او تقنيات او برامج او اي شيئ نحتاجه لعملنا لنستخدمه او نعمل مثله لكن اقوى <br>**evidence:** pi auth → lib/auth |
| [R004](requests-recovered.md#r004) |2026-07-28|`data`|| `answered` | هل الاختيار الثني مناسب لهدفنا وهل مستقبلا سهل نغير قاعدة البيانات الى اخرى دون مشاكل او اخطاء |
| [R005](requests-recovered.md#r005) |2026-07-28|`globe`|| `needs-check` | نعم وتذكر القاعدة في كل مشروعنا ان نعمل كل نقطة بشكل نهائي ولا مجال للحلول المؤقة او الحلول التي فيها مشاكل مستقبلا وتذكر دائما اعمل بحثك الشامل و الفروع وتكون عل علم او <br>**evidence:** globe → components/globe-view.tsx |
| [R006](requests-recovered.md#r006) |2026-07-28|`competitors`|| `needs-check` | ارسلت لك ملف التطبيق وتذكر ان يكون العمل متوافق مع شبكة الباي نوتورك او البرمجة وايضا الدفع بعملة الباي وغيرها وايضا حتى لو اردنا تطبيقنا ان نعمل له موقع او تطبيق ليس على <br>**evidence:** pi auth → lib/auth; payments → lib/payments |
| [R007](requests-recovered.md#r007) |2026-07-28|`ai`|| `needs-check` | [ملف] الجديد الأهم فيه: الباب الثاني توسّع من صفحة إلى ١٩ قسماً، ويغطي الآن كل ما كان ناقصاً: CI، Market Intelligence، BI، HUMINT، SIGINT/MASINT/TECHINT، تحليل البيانات، <br>**evidence:** sources → lib/engine/catalog; competitors → docs/COMPETITORS.md; database → db/schema.ts |
| [R008](requests-recovered.md#r008) |2026-07-28|`ai`|| `needs-check` | الجديد الأهم فيه: الباب الثاني توسّع من صفحة إلى ١٩ قسماً، ويغطي الآن كل ما كان ناقصاً: CI، Market Intelligence، BI، HUMINT، SIGINT/MASINT/TECHINT، تحليل البيانات، الكشط، <br>**evidence:** sources → lib/engine/catalog; competitors → docs/COMPETITORS.md; database → db/schema.ts |
| [R009](requests-recovered.md#r009) |2026-07-28|`general`|| `answered` | اكمل عملك بدقة و |
| [R010](requests-recovered.md#r010) |2026-07-29|`general`|| `answered` | نعم اكمل لكن اخر ملاحضتين لم افهم عليهم |
| [R011](requests-recovered.md#r011) |2026-07-29|`general`|| `answered` | اكمل عملك بدقة وتسلسل عبر المراحل |
| [R012](requests-recovered.md#r012) |2026-07-29|`competitors`|| `answered` | نعم واهمها يكون حقيقيوبدقة وبدون منافي وذات طفرة غير مقبول تقليده او منافسته |
| [R013](requests-recovered.md#r013) |2026-07-29|`sources`|| `needs-check` | يئة البناء هذه تحجب الخروج الشبكي (قائمة سماح)، فالمصادر لا تُنادى حيّاً هنا — لكنها ستعمل فور النشر. إن أردت أن أُريك تحقيقاً حيّاً حقيقياً الآن، أضف هذه المضيفات إلى إع <br>**evidence:** sources → lib/engine/catalog; publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R014](requests-recovered.md#r014) |2026-07-29|`general`|| `answered` | نعم واصل بتسلسل |
| [R015](requests-recovered.md#r015) |2026-07-29|`general`|| `answered` | نعم ولكن هناك ملاحضة هل كل العمل السابق اكملته بكل ملحقلته |
| [R016](requests-recovered.md#r016) |2026-07-29|`design`|| `answered` | نعم ودائما التنسيق والترتيب احترافي فخم والاهم قوة وحقيقة وسرعة العمل والنتائج الفائقة |
| [R017](requests-recovered.md#r017) |2026-07-29|`general`|| `answered` | نعم ودائما تذكر مالم نكمله وماخلفناه عمدا |
| [R018](requests-recovered.md#r018) |2026-07-29|`design`|| `open` | نعم ولكن هناك امرين الاول لااريد تغيير كثيرا عن التصميم الاصلي والثاني هل ماكان موجود في التطبيق وتوجهه واهدافه كما كان علو شكل واجهة وهمي هل غيرت الهدف للتطبيق او التوجه |
| [R019](requests-recovered.md#r019) |2026-07-29|`general`|6| `answered` | اكمل الافضل البناء |
| [R020](requests-recovered.md#r020) |2026-07-29|`globe`|| `needs-check` | Base directory for this skill: /tmp/claude-0/bundled-skills/2.1.220/8704d107143388ad8111c7daf3382dfa/claude-api # Building LLM-Powered Applications with Claude This skill <br>**evidence:** blockchain → lib/modules/chain-radar.ts; agents → .claude/agents; api docs → lib/api-catalog.ts |
| [R021](requests-recovered.md#r021) |2026-07-30|`general`|| `answered` | اكمل الافضل البناء اكمل الافضل البناء |
| [R022](requests-recovered.md#r022) |2026-07-31|`news`|| `needs-check` | نعم واصل ووهناك تنويه هل عملت بحثك حول اهم ثروات الارض والبورصات واهم العملات الرقمية والاسهم وطريقة مراقبتهم وتتبع كل مايتعلق وطرح الابحاث عنهم وتطلعاتهم والتكنولوجيا ال <br>**evidence:** news → lib/modules/news.ts; sources → lib/engine/catalog; monitoring → lib/alerts |
| [R023](requests-recovered.md#r023) |2026-07-31|`sources`|| `needs-check` | اكمل العمل وهل وضعت بحسبانك امكانية الحجز او الشراء او الطلب وايضا عالم العقارات العالمية والصناعية واقول لك لاحضتك منحصر في المجالات والمصادر والتوجهات التي اقولها لك فق <br>**evidence:** sources → lib/engine/catalog |
| [R024](requests-recovered.md#r024) |2026-07-31|`design`|| `open` | اكمل وهناك ملاحضة حتى تصميم تطبيقنا الاول قبل بدا عملنا صحيح فخم لكن لايرقى لما وصلنا له الان من التجهيز هناك طلب اريد فيه مزيج من التويتر وفيه الشبه تصميم استخبراتي لكن |
| [R025](requests-recovered.md#r025) |2026-07-31|`general`|| `answered` | [Image: original 430x2581, displayed at 333x2000. Multiply coordinates by 1.29 to map to original image.] |
| [R026](requests-recovered.md#r026) |2026-07-31|`globe`|| `needs-check` | وايضا نوفر مكان بدقة واحترافية يعرض اهم الاخبار العالمية خاصة الاكثر تداول واهم الشراكات ارجو ان تعمل بحث لنوع وتفرع وطريقة واختيار والاماكن ومايلزم لهذه النقطة واهم المص <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R027](requests-recovered.md#r027) |2026-07-31|`news`|| `needs-check` | وطبعا مكان لعرض اهم اسعار ثروات ومواد الخام وغيرها واهم انواع العملات الرقمية واهم البورصات وسوق الاسهم وما يليه وكل ما يشبه او داخل هذا الباب وتنضيمها ليكون العرض وتتبع <br>**evidence:** news → lib/modules/news.ts |
| [R028](requests-recovered.md#r028) |2026-07-31|`globe`|| `needs-check` | اهم نقطة السرعة ووصول اي معلومة او سعر في لحضتها واقول لك شيئ حتى الان انا اعطيتك فكرتين قويتين وانت لم تعرض او تعطي اي فكرة او ابتكار او اي شيئ قوي يدفع بتطبيقنا للعالمي <br>**evidence:** globe → components/globe-view.tsx; payments → lib/payments |
| [R029](requests-recovered.md#r029) |2026-07-31|`globe`|| `needs-check` | ولا تنسى تطبيقنا يدعم كل لغات العالم ابدا كما يساعد ويوافق عملنا وايضا اريد فكرة حيث ميزة نستقبل فيها اقتراحات او تطويرات او توجات او تعديل او افكار او نصائح لتطبيقنا وتك <br>**evidence:** globe → components/globe-view.tsx |
| [R030](requests-recovered.md#r030) |2026-07-31|`globe`|| `needs-check` | وهناك ملاحضة مثلا في عرض سعر سهم او عملة اوبورصة يجب توفر عرض لماضي ومستقبل واهم نقاط الهدف والمهم هو تتبع الهدف بميزة تعرض هدف واهم الشراكات او الاتفاقيات اوالاعلانات او <br>**evidence:** news → lib/modules/news.ts; payments → lib/payments; competitors → docs/COMPETITORS.md |
| [R031](requests-recovered.md#r031) |2026-07-31|`general`|| `answered` | هل قرات اخر رسالة ارسلتها لك وكما اوصيتك عليها في اخر الرسالة قبلها |
| [R032](requests-recovered.md#r032) |2026-07-31|`ai`|| `open` | امام اكمل عملك ولاحضت انك لم تجلب افكار او ابتكارات انت فقط تعتمد عليا مع انك فائق الذكاء |
| [R033](requests-recovered.md#r033) |2026-07-31|`general`|| `answered` | اكمل العمل ام هناك شيء للتتوقف |
| [R034](requests-recovered.md#r034) |2026-07-31|`general`|| `answered` | نعم اكمل كما يكون لك افضل |
| [R035](requests-recovered.md#r035) |2026-07-31|`general`|| `answered` | اكمل دون توقف |
| [R036](requests-recovered.md#r036) |2026-08-01|`general`|| `answered` | اكمل اكمل |
| [R037](requests-recovered.md#r037) |2026-08-01|`globe`|| `needs-check` | اكمل نعم وضع بحسبانك طريقة سريعة وسهلة لكي نغير او نتحكم بالدفع او سعر الاشتراك وهناك ملاحضة البارحة اعطيتك طلبات منها عند الضغط على سعر سهم او مواد خام او احد الاخبار او <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R038](requests-recovered.md#r038) |2026-08-01|`globe`|| `answered` | ممتاز وتذكر ان يكون الزوم ذات جودة عالية وتذكر ان توضف هذه الفكرة في اي نقطة يحتاجها او توافق هذه الفكرة في تطبيقنا |
| [R039](requests-recovered.md#r039) |2026-08-01|`general`|| `answered` | نعم اكمل كما يوافق سير ملك |
| [R040](requests-recovered.md#r040) |2026-08-01|`general`|| `answered` | ساغيب ساعتين اكمل مهامك بتسلسل ولا تنضر امر مني الا اذا كان يجب ان اقدم او اختار ضروري اكمل حتى لو اغلقت شاشة الحاسوب |
| [R041](requests-recovered.md#r041) |2026-08-01|`auth`|| `answered` | اكمل وحدك انشاء حساب على قاعدة البيانات |
| [R042](requests-recovered.md#r042) |2026-08-01|`i18n`|2| `needs-check` | تكلم عربي دائما <br>**evidence:** i18n/arabic → lib/i18n |
| [R043](requests-recovered.md#r043) |2026-08-01|`general`|| `answered` | نعم تطبيق دابيا وفاليتبي لا اريد المساس بهم ابدا لكن ذلك المشروع المتوقف افحصه ان كان فارغا وعند حذفه يمكننا مسحه اذا كان دون ضرر عن التطبيقات الاخرى |
| [R044](requests-recovered.md#r044) |2026-08-01|`general`|| `answered` | هل يمكنك العمل على المشروع المتوقف |
| [R045](requests-recovered.md#r045) |2026-08-01|`data`|| `needs-check` | ماهي افضل واقوى وملائم وامن قاعدة بيانات <br>**evidence:** database → db/schema.ts |
| [R046](requests-recovered.md#r046) |2026-08-01|`auth`|| `needs-check` | ماذا لو انشات حساب على : Neon وتنقل انت المشروع فاليت لها ونكمل تطبيقنا supabase <br>**evidence:** accounts → lib/auth; database → db/schema.ts |
| [R047](requests-recovered.md#r047) |2026-08-01|`general`|| `answered` | لكن في المستقبل خياري افضل |
| [R048](requests-recovered.md#r048) |2026-08-01|`data`|| `needs-check` | تطبيق فاليت حتى الان لمليس طور العمل الجاد وحقيقي المغامرة اليوم افضل وهناك قاعدة بيانات تابعة لجوجل يمكن تكون خيار مناسب له <br>**evidence:** database → db/schema.ts |
| [R049](requests-recovered.md#r049) |2026-08-01|`general`|| `answered` | Firebase / Firestore اقصد هذا ام نضع تطبيقنا لامدا افضل ملائمة له |
| [R050](requests-recovered.md#r050) |2026-08-01|`pi`|| `needs-check` | خياري ان نعمل حساب Neon وننقل له فاليت وسازودك باي ادوات تريدها ثم ننشل لامدا على Supabase <br>**evidence:** pi auth → lib/auth; accounts → lib/auth; database → db/schema.ts |
| [R051](requests-recovered.md#r051) |2026-08-01|`auth`|| `needs-check` | قبل نقل VaultPi يجب أن أعرف ماذا يستخدم فعلًا، لأن Neon هو Postgres فقط: * إن كان VaultPi يستخدم فقط جداول Postgres عادية → النقل سهل ونظيف. ✅ * إن كان يستخدم Supabase Au <br>**evidence:** accounts → lib/auth; publishing → lib/modules/autopublish.ts; database → db/schema.ts |
| [R052](requests-recovered.md#r052) |2026-08-01|`general`|2| `open` | لكن مستقبلا سنواجه نفس الامر على تطبيقنا اعمل ايقاف لفاليت لكن دون اذا وانشا تطبيقنا |
| [R053](requests-recovered.md#r053) |2026-08-01|`auth`|7| `needs-check` | هناك امر قبل اكمال العمل هل يمكن انشاء حساب اخر علىsupabase ],دون مشاكل وترك تطبيقاتنا دابيا وفاليت على حالهم <br>**evidence:** accounts → lib/auth; database → db/schema.ts |
| [R054](requests-recovered.md#r054) |2026-08-06|`i18n`|| `needs-check` | لأربط التطبيق بالقاعدة أحتاج كلمة مرور قاعدة البيانات — وهي لا تظهر لأدواتي إطلاقًا (لأسباب أمنية Supabase لا تكشفها عبر API). تجدها هنا: لوحة Supabase → مشروع Lambda-NX <br>**evidence:** i18n/arabic → lib/i18n; database → db/schema.ts; api docs → lib/api-catalog.ts |
| [R055](requests-recovered.md#r055) |2026-08-06|`general`|| `answered` | الان نسخت كلمة المرور |
| [R056](requests-recovered.md#r056) |2026-08-06|`deploy`|| `needs-check` | أين تضع كلمة المرور الآن؟ كلمة المرور وحدها لا تكفي — نحتاج الرابط الكامل. خذ الرابط من زرّ «Connect» الأخضر (اختر Transaction pooler)، وسيبدو هكذا: ``` postgresql://[REDACTED-CONNECTION-STRING] <br>**evidence:** publishing → lib/modules/autopublish.ts; database → db/schema.ts |
| [R057](requests-recovered.md#r057) |2026-08-06|`general`|| `answered` | هل هذا |
| [R058](requests-recovered.md#r058) |2026-08-06|`i18n`|| `needs-check` | تكلم دائما بالعربي اين اجد الرابك <br>**evidence:** i18n/arabic → lib/i18n |
| [R059](requests-recovered.md#r059) |2026-08-06|`deploy`|| `needs-check` | اعطني مكان الرابط الذي انشره مع الكود <br>**evidence:** deploy → netlify.toml |
| [R060](requests-recovered.md#r060) |2026-08-06|`data`|| `answered` | لم اجد الرابط في قاعدة البيانات |
| [R061](requests-recovered.md#r061) |2026-08-06|`deploy`|| `needs-check` | قبل ساعات طلبت مني ان اضيف متغير بيئي وانشره لكن للان لم افعل لاني لم اجد الرابط من قاعدة البيانات <br>**evidence:** deploy → netlify.toml |
| [R062](requests-recovered.md#r062) |2026-08-06|`globe`|| `needs-check` | Transaction pooler (أو "Connection pooling") ٤) اضغط أيقونة النسخ 📋 بجانبه ٥) الرابط الآن في الحافظة، لكن مكان كلمة المرور مكتوب فيه [YOUR-PASSWORD] — الصقه في المفكرة (N <br>**evidence:** globe → components/globe-view.tsx; deploy → netlify.toml; database → db/schema.ts |
| [R063](requests-recovered.md#r063) |2026-08-06|`general`|| `answered` | اين اجد الرابط بالضبط لنسخه |
| [R064](requests-recovered.md#r064) |2026-08-06|`i18n`|| `needs-check` | اعطني اسم الاعدادات بالعربي <br>**evidence:** i18n/arabic → lib/i18n |
| [R065](requests-recovered.md#r065) |2026-08-06|`general`|| `answered` | من هو |
| [R066](requests-recovered.md#r066) |2026-08-06|`general`|| `answered` | فوق «Session pooler» مباشرةً توجد ثلاثة أزرار اختيار (⚪). اختر الأوسط: بعد اختيار هذا ماذا افعل |
| [R067](requests-recovered.md#r067) |2026-08-06|`general`|| `needs-check` | انظر إلى port أسفل النافذة: يجب أن يصير 6543 بدل 5432، وuser يصير postgres.roykbyzkskhmzclzobmd. إن لم تتغيّر، فأنت لم تضغط الزر الصحيح. ٢) تأكّد أن Type = URI موجود عندك <br>**evidence:** publishing → lib/modules/autopublish.ts |
| [R068](requests-recovered.md#r068) |2026-08-06|`general`|| `answered` | انا فقط اخترت «Session poole ولا يوجد زر حفض لو تغيير |
| [R069](requests-recovered.md#r069) |2026-08-06|`deploy`|| `needs-check` | postgresql://[REDACTED-CONNECTION-STRING] هذا مانسخته <br>**evidence:** publishing → lib/modules/autopublish.ts; database → db/schema.ts |
| [R070](requests-recovered.md#r070) |2026-08-06|`security`|| `answered` | هل اغير كلمة السر من تفكيري فقط |
| [R071](requests-recovered.md#r071) |2026-08-06|`deploy`|| `needs-check` | ارسلي خطوة Supabase ي بالخطوات ليقوم بها شخص اخلالر <br>**evidence:** database → db/schema.ts |
| [R072](requests-recovered.md#r072) |2026-08-06|`general`|| `answered` | نعم اضف المتغيرات الاغري |
| [R073](requests-recovered.md#r073) |2026-08-06|`deploy`|| `needs-check` | لقد انتهى الحد للنشر في نيتفلي وجربت النشر على فيرسل لكن هناك خطا وهذا من سجلات البناء 09:57:41.061 Running build in Washington, D.C., USA (East) – iad1 09:57:41.061 Buil <br>**evidence:** publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R074](requests-recovered.md#r074) |2026-08-06|`security`|| `answered` | نعم انقلها الان لكن اولا بسرعة جاوبني اولا هل اقوم باعادة النسر الان او ماذا |
| [R075](requests-recovered.md#r075) |2026-08-06|`general`|| `answered` | نعم ثم اكمل بعدك الخطوات المطلوبة مني |
| [R076](requests-recovered.md#r076) |2026-08-06|`general`|| `answered` | PR #2 لا ينتظر إلا دمجك. اين ادمج هذا |
| [R077](requests-recovered.md#r077) |2026-08-06|`pi`|| `needs-check` | ``` {"status":"degraded","version":"0.0.0","time":"2026-08-06T21:39:41.829Z","uptimeSeconds":191,"providers":{"auth":"pi","payment":"pi","storage":"filesystem","queue":"m <br>**evidence:** secrets → docs/SECURITY.md; database → db/schema.ts; api docs → lib/api-catalog.ts |
| [R078](requests-recovered.md#r078) |2026-08-06|`payments`|| `needs-check` | لاختبار الحقيقي — يثبت كل شيء دفعة واحدة نفّذ هذا (ضع `CRON_SECRET` الذي اخترته): ``` curl -X POST -H "x-cron-secret: سرّك" \ ``` ` "https://lambda-nx1-m4pp-two.vercel.ap <br>**evidence:** payments → lib/payments; publishing → lib/modules/autopublish.ts; secrets → docs/SECURITY.md |
| [R079](requests-recovered.md#r079) |2026-08-06|`general`|| `answered` | الان ماذا افعل |
| [R080](requests-recovered.md#r080) |2026-08-06|`general`|| `answered` | https://lambda-nx1-m4pp-two.vercel.app هل هذا هو الرابط للتطبيق لان ساكما مهام الديفلوبر |
| [R081](requests-recovered.md#r081) |2026-08-06|`general`|| `answered` | ليس لدس دومين في نيتفلي لكن هليمكنني تعديل اسم الرابط في فيرسل |
| [R082](requests-recovered.md#r082) |2026-08-06|`general`|| `open` | اصلح هذا |
| [R083](requests-recovered.md#r083) |2026-08-06|`general`|| `answered` | لماذا يبقى هكذا |
| [R084](requests-recovered.md#r084) |2026-08-06|`auth`|| `answered` | NEXT_PUBLIC_AUTH_MODE = standalone AUTH_PROVIDER = standalone كيف اعمل هذا بالضبط لان الاولى لم تنجح |
| [R085](requests-recovered.md#r085) |2026-08-06|`general`|| `open` | اريد حل دائم |
| [R086](requests-recovered.md#r086) |2026-08-07|`general`|| `answered` | اليس الخطا هنا |
| [R087](requests-recovered.md#r087) |2026-08-07|`general`|| `answered` | لم ينجح هل هناك خطا في اعدادات فيريل |
| [R088](requests-recovered.md#r088) |2026-08-07|`general`|| `answered` | لم اجده اعطني رابط مباشر او قم انت بها وحدك |
| [R089](requests-recovered.md#r089) |2026-08-07|`general`|| `open` | يجب عليك اصلاح الخطأ بالضبط وحدك |
| [R090](requests-recovered.md#r090) |2026-08-07|`deploy`|| `needs-check` | يجب عليك اصلاح خطا النشر الان <br>**evidence:** publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R091](requests-recovered.md#r091) |2026-08-07|`pi`|| `needs-check` | اعطني رابط التطبيق الذي ساضعه في ديفلوبر الباي نوتورك <br>**evidence:** pi auth → lib/auth |
| [R092](requests-recovered.md#r092) |2026-08-07|`globe`|| `needs-check` | اكمل البناء الان وايضا هناك ملاحضة في التطبيق في صفحة الكرة الارضية فهي تتعطل مجرد ال\دخول لها وايضا تبدو فقط الرسم ولا يوجد للبيانات والتقنيات والاخبار والرادار الاني لا <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; pi auth → lib/auth |
| [R093](requests-recovered.md#r093) |2026-08-07|`globe`|| `needs-check` | لما ادخل تضهر رسم الثلاثي الابعاد للكرة وحده بعده تتعطل الصفحة تصير بيضاء الان ماجربت بعد رسالتك هذه واقول لك اكمل كل عملك المتبقي وهناك قواعد يجب تعمل بها دائما لما تعمل <br>**evidence:** globe → components/globe-view.tsx; publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R094](requests-recovered.md#r094) |2026-08-07|`pi`|| `answered` | هل اضفت ترجمة جوجل كل اللغات العالمية في التطبيق ةتسجيل الدخول باسم مستخدم الباي نوتورك |
| [R095](requests-recovered.md#r095) |2026-08-07|`pi`|| `needs-check` | نعم اكمل تلك اكول معك كل هذا كل العمل مدموج ومنشور، والملف v02 مُرسَل. سؤالي الأخير ما زال قائمًا: أيّ الثلاثة أبدأ به — إبراز البوابات الـ١٦ (توصيتي)، أم شاشة الشراء بـ <br>**evidence:** i18n/arabic → lib/i18n; accounts → lib/auth; publishing → lib/modules/autopublish.ts |
| [R096](requests-recovered.md#r096) |2026-08-07|`general`|| `open` | قلت لك اكمل كل المتبقي بكل تفاصيله ومايحتاجه من تطوير وتعديل وبكل دقة واحترافية |
| [R097](requests-recovered.md#r097) |2026-08-07|`general`|| `open` | حملت اخر ملف ولميفتح التطبيق |
| [R098](requests-recovered.md#r098) |2026-08-07|`globe`|| `needs-check` | الان يجب معالجة التطبيق كل نقطة فيه وكل ميزة وتقنية كأنك انت المستخدم وتريد استعمال تطبيقنا وتحتاجه في عدة اعمال حقيقية ودقيقة ومعقدة جداا واعمل هذا بعدة انواع كأنك مستخد <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R099](requests-recovered.md#r099) |2026-08-07|`news`|| `needs-check` | الاول نختار المجاني لوقت لاحق نعدله والثاني النشر يكون على التطبيق نفسه وحتى مشاركته خارج التطبيق او نسخ الرابط للمنشور للتوسع والترويج وتكون صفحة النشر للمنشورات والاحدا <br>**evidence:** news → lib/modules/news.ts; publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R100](requests-recovered.md#r100) |2026-08-07|`general`|| `needs-check` | API Error: Output blocked by content filtering policy <br>**evidence:** api docs → lib/api-catalog.ts |
| [R101](requests-recovered.md#r101) |2026-08-07|`general`|| `answered` | اكمل كل الباقي بعدها نزل الملف الجديد وايضا هل انت متاكد انك عملت كل الذي طلبته منك |
| [R102](requests-recovered.md#r102) |2026-08-07|`globe`|| `needs-check` | * العقل الباحث غير المنحاز، والنشر التلقائي على الشبكات (يحتاج حساباتك) الان اجع النشر على التطبيق وجهز لوحة تحكم في قاعدة البيانات اتحكم بها من خلا وضع روابط مواقع التوا <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; pi auth → lib/auth |
| [R103](requests-recovered.md#r103) |2026-08-08|`globe`|| `needs-check` | اكمل الباقي واصلح الاخطاء وعندي ملاحضة على عملك ضعيف وغير احترافي ويفتقد للابتكار وهناك الكثير من الطلبات لم تقم بها ابدا ومنها وضعتهة بطريقة بدائية وغير فعالة وايضا قلت <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R104](requests-recovered.md#r104) |2026-08-08|`general`|| `answered` | اعطني رابط التطبيق لارى اخر التطوير |
| [R105](requests-recovered.md#r105) |2026-08-08|`ai`|| `needs-check` | هلب متاكد ان تطبيقنا كله مضبوط مع قاعدة البياناتhttps://agentswarmquantu5456.pinet.com وهذا الرابط الرسمي للتطبيق عل ابستيديو <br>**evidence:** agents → .claude/agents |
| [R106](requests-recovered.md#r106) |2026-08-13|`data`|| `open` | اكمل كل العمل واكمل كل ماطابته منك وكل ماجهزناه للتطبيق حتى اخر نقطة في التطبيق كاخر تطوير واصلاح الاخطاء واتمام كل المهام وكل مايلزم مع فيرسل وقاعدة البيانات لانه حتى ال |
| [R107](requests-recovered.md#r107) |2026-08-13|`general`|2| `open` | قلت لك اكمل كل شيئ |
| [R108](requests-recovered.md#r108) |2026-08-13|`general`|| `answered` | هل اكملت كل المهام وهل هذه اخر نسخة لنتيجة كل التطبيق |
| [R109](requests-recovered.md#r109) |2026-08-13|`payments`|| `needs-check` | ما يلزمك: دمج هذه الدفعات إلى main (قل «افتح PR» وأفتحه فورًا)، وضبط CRON_SECRET وADMIN_SECRET وSOCIAL_SECRET_KEY وDATABASE_URL على Vercel ثم إعادة النشر. ولا أزال غير قا <br>**evidence:** payments → lib/payments; publishing → lib/modules/autopublish.ts; secrets → docs/SECURITY.md |
| [R110](requests-recovered.md#r110) |2026-08-13|`security`|| `needs-check` | جوابك معقط اعطني المفاتيح بجانب كل قيمة له دون تعقيد وكلام فارغ <br>**evidence:** secrets → docs/SECURITY.md |
| [R111](requests-recovered.md#r111) |2026-08-13|`general`|| `answered` | ر من هي بالظبط |
| [R112](requests-recovered.md#r112) |2026-08-13|`i18n`|| `needs-check` | اعطني الطريقة علة نتفلي بالعربي <br>**evidence:** i18n/arabic → lib/i18n |
| [R113](requests-recovered.md#r113) |2026-08-13|`general`|| `answered` | حاولت اضافة المتغيرات لكن لم يقبل لانه كانت موجودة سابقا والتطبيق لم يتغير |
| [R114](requests-recovered.md#r114) |2026-08-13|`competitors`|| `open` | لليس مشكل زيب ابدا انا اتصفح من خلال فيرسل ونيتقلي وهذه الصورة من قاعدة البيانات لعلها تفيدك |
| [R115](requests-recovered.md#r115) |2026-08-13|`deploy`|| `needs-check` | اي نشر تلقائي تقصده <br>**evidence:** publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R116](requests-recovered.md#r116) |2026-08-13|`general`|| `answered` | اعطني ماذا افعل انا او اكمله وحدك |
| [R117](requests-recovered.md#r117) |2026-08-13|`auth`|| `needs-check` | curl.exe -H "Authorization: Bearer ضع-قيمة-CRON_SECRET" https://lambda-nx.vercel.app/api/cron/publish كيف اقوم بهذا ياغبي <br>**evidence:** secrets → docs/SECURITY.md; api docs → lib/api-catalog.ts; commit 6d7f221 Merge pull request #18 — cron schedules within the Vercel plan |
| [R118](requests-recovered.md#r118) |2026-08-13|`deploy`|| `needs-check` | من فضلك انا لم افهم مع اي شيئ يجب عليك اصلاح كل هذا وحدك الان وايضا هناك امر لعله السبب في قيتهيب جعلت المستودع خاص المهم هو اصلح وحدك ولا تتكلم الا بعد الاصلاح الكامل <br>**evidence:** deploy → netlify.toml |
| [R119](requests-recovered.md#r119) |2026-08-13|`deploy`|| `needs-check` | https://superb-fox-8b11f5.netlify.app/ هذا اخر رابط نشرته على نيتفلي <br>**evidence:** deploy → netlify.toml |
| [R120](requests-recovered.md#r120) |2026-08-13|`auth`|| `needs-check` | fetch('/api/cron/publish',{headers:{Authorization:'Bearer V8ieBu5C7pmQvaUSWwk1J349c6AYnTRgDPEqO0dr'}}).then(r=>r.json()).then(console.log) ماذا افعل بهذا <br>**evidence:** api docs → lib/api-catalog.ts |
| [R121](requests-recovered.md#r121) |2026-08-13|`general`|| `answered` | طيب هل الان بخبرتك وعملك هل انتهى كل التطوير ووصلنا للهدف للانطلاق |
| [R122](requests-recovered.md#r122) |2026-08-13|`auth`|| `needs-check` | اكمل كل هذ دون توقف خاصة الزوار و تسجيل المستخدمين حقيقي وان التطبيق يعمل ووصلنا لكل ماخططنا له لنمر لاشياء اخرى لانك انجزت1 من 100 من خطتنا وعملك خير احترافي ومبتكر وكثي <br>**evidence:** accounts → lib/auth |
| [R123](requests-recovered.md#r123) |2026-08-13|`pi`|| `needs-check` | قرار واحد يخصّك: أي رابط تعتمده رسميًا؟ rococo-centaur يعمل ويُحدَّث تلقائيًا. إن أردت superb-fox رابطًا نهائيًا (مثلًا لأنه المسجَّل في بوابة Pi)، اربطه بـ GitHub مرة وا <br>**evidence:** deploy → netlify.toml |
| [R124](requests-recovered.md#r124) |2026-08-13|`deploy`|| `needs-check` | lambdanx تذكر يوجد مستودعين بنفس الاسم لكن الذي بجانبه 1 هو الصحيح هذ lambdanx1 وايضا اعطني ملف زيب لنملا للمرحلى الثانية <br>**evidence:** deploy → netlify.toml |
| [R125](requests-recovered.md#r125) |2026-08-14|`globe`|| `needs-check` | حاليا بعد شهرين لم نصل للهدف وكان عملنا كثير الاخطاء وكثير الطلبات والاشياء لم تقم بها والاغلب اضفتها تحتاج كثير الاصلاح والتطوير والتعديل مع العلم وضحتلك الكثير الان سار <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R126](requests-recovered.md#r126) |2026-08-14|`globe`|| `needs-check` | نعم، وهذه الفكرة أقوى بكثير من مجرد إنشاء نسخة من World Monitor. أنت تتحدث عن منصة موحدة للوعي التشغيلي والبيانات العالمية تخدم المواطن، الشركات، الباحثين، الصحفيين، غرف <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R127](requests-recovered.md#r127) |2026-08-14|`globe`|| `needs-check` | نعم. وإذا كان هدفك فعلًا تجاوز هذه المنصات مجتمعة، فأهم شيء هو ألا نبدأ من سؤال «ما الميزات التي نضيفها؟»، بل من سؤال: > أين تفشل المنصات الحالية؟ ولماذا؟ وكيف نصمم النظا <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R128](requests-recovered.md#r128) |2026-08-14|`globe`|| `needs-check` | الان ليس لك اي عذر اول شيئ ان لم تعمل افضل من هذا واكبر واقوى وادق والمهم كل ماموجود في تلك المواقع يجب توفره في مشروعنا وحتى افضل منه وبكل التفاصيل وملاحضي ليس بعد ان تع <br>**evidence:** globe → components/globe-view.tsx; pi auth → lib/auth; accounts → lib/auth |
| [R129](requests-recovered.md#r129) |2026-08-14|`globe`|| `needs-check` | المرحلة الثانية التي قلت لك وارسلت لك رسائل وروابط لمواقع مختلفة لكنك وفي اجاباتك السابقة انت ركزت على موقع واحد تقريبا هذا نعم. إذا كنت تريد بناء تطبيق مشابه لـ World Mo <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; sources → lib/engine/catalog |
| [R130](requests-recovered.md#r130) |2026-08-14|`competitors`|| `answered` | لا تتوقف اكمل عملك وبحثك في كل المستودعات والمواقع العالمية اللاكبر والاقوى وانت لازلت تضن ان فقط Monitor. موجود |
| [R131](requests-recovered.md#r131) |2026-08-14|`sources`|| `answered` | اكمل ان لمتعمل افضل من اكبر المواقع واوسع منهم واكبر مصادر واكبر توسع اعرف انك لم تبدا العمل الحقيقي |
| [R132](requests-recovered.md#r132) |2026-08-14|`globe`|| `needs-check` | اكمل الكل دون توقف اريد تطبيقنا اوسع واكبر وادق ومصحح للاخطاء ومزود بابتكاراتنا الخاصة بككل الطفرات لتكنلوجيا المستقبل والوصول لكل شيئ عن كل التطبيقاتا المشابهة كلها افتح <br>**evidence:** globe → components/globe-view.tsx; news → lib/modules/news.ts; competitors → docs/COMPETITORS.md |
| [R133](requests-recovered.md#r133) |2026-08-14|`competitors`|| `needs-check` | اكمل عملك وتذكر كل خطتنا وحتا القادم من التكنلوجيا الحديثة والتي لم تطلق وحتى التكنولوجيا الكمية الاهم نصل لاقوى اداء وتوسع وسرعة وقوة وتقييم من كل المشاريع المشابهة لمشر <br>**evidence:** competitors → docs/COMPETITORS.md |
| [R134](requests-recovered.md#r134) |2026-08-14|`sources`|| `needs-check` | اجب بسرعة ومختصر كم لدينا مصدر الان وهل فتحت صفحات المشروع ورايت اين وصلنا والاهم لو انك مستخدم خبير واخترت اقوى واكبر 50موقع او تطبيق مشابه لمشروعنا كيف ترى مشروعنا بكل <br>**evidence:** sources → lib/engine/catalog; competitors → docs/COMPETITORS.md |
| [R135](requests-recovered.md#r135) |2026-08-14|`globe`|| `needs-check` | تكاملات (نستدعيها ونحلّلها) 179 كتالوج + 59 مبرمَجة = 238 مضيفات مختلفة 163 أصول مستقلة (الرقم الوحيد الذي يدخل التقييم) 159 بوابات بيانات حكومية (CKAN) 30 (22 نشطة) الوص <br>**evidence:** news → lib/modules/news.ts; sources → lib/engine/catalog; competitors → docs/COMPETITORS.md |
| [R136](requests-recovered.md#r136) |2026-08-14|`competitors`|| `needs-check` | 1. تفعيل الوصول لعدم الحضور (قائمة السماح للنطاقات، أو إيقاف الحجب غير المسموح به). 2. أو — أسرع — أرسل لي مخرجات JSON مباشرة : سجل في متصفحك `lambdanx.netlify.app/api/wo <br>**evidence:** i18n/arabic → lib/i18n; deploy → netlify.toml; api docs → lib/api-catalog.ts |
| [R137](requests-recovered.md#r137) |2026-08-14|`competitors`|| `open` | لم ينجح اعطني طريقة تفعيل لتتصفح وحدك كل المواقع |
| [R138](requests-recovered.md#r138) |2026-08-14|`competitors`|| `open` | اهم نقطة اريد الان ان تتصفح وتجرب حقيقي وتقارن تطبيقنا و30 تطبيق اخر لاتتجاوز هذه النقطة الان فانت تضيع في الوكت فقط منذ اكثر من شهر |
| [R139](requests-recovered.md#r139) |2026-08-14|`competitors`|| `answered` | جرب الان انا فعلتها وهل هكذا تصل وتتصفح اي تطبيق وكل المواقع |
| [R140](requests-recovered.md#r140) |2026-08-14|`globe`|| `needs-check` | اصلح الاول والثاني واكل الثلاثة وهناك ملاحضة مهمة لما تدخل تتصفح كل التطبيقات ركز عل كل النقاط والصفحات وكل التفاصيل الصغيرة والكبيرة بالتصفح والتجربة والاختبار ولاحض صفح <br>**evidence:** globe → components/globe-view.tsx; payments → lib/payments |
| [R141](requests-recovered.md#r141) |2026-08-14|`competitors`|| `answered` | هل الان يمكنك تصفح حقيقي لكل المواقع حتى موقعنا اجبني بسرعة الان |
| [R142](requests-recovered.md#r142) |2026-08-14|`competitors`|| `needs-check` | افحص وقارن اقوى 30 موقع او اكثر مع موقعنا بما ذلك مستودعاتهم وكل ماهو مربوط ومدعوم ويستعمل و قارن كم هو موقعنا متأخر وغير مرتب ويفتقر للكثير من التقنيات والمزايا وعقل الت <br>**evidence:** deploy → netlify.toml |
| [R143](requests-recovered.md#r143) |2026-08-14|`competitors`|| `needs-check` | نعم ابدا وتذكر وماهو المستودعات والمعلامات والمواقع وكل مالم تستطع الوصول له احفضه سنعالجه لاحقا وحتى بحثك ينقصه الكثير جداا <br>**evidence:** deploy → netlify.toml |
| [R144](requests-recovered.md#r144) |2026-08-14|`deploy`|| `needs-check` | والان بعد النشر <br>**evidence:** publishing → lib/modules/autopublish.ts; deploy → netlify.toml |
| [R145](requests-recovered.md#r145) |2026-08-14|`deploy`|| `needs-check` | تذكر ان هناك مستودعين من نفس الاسم لكن الذي بجانبه رقم 1 هو الاصح <br>**evidence:** deploy → netlify.toml |
| [R146](requests-recovered.md#r146) |2026-08-15|`competitors`|| `answered` | اكمل ولا تتوقف حتى تتجاوز كل المواقع |
| [R147](requests-recovered.md#r147) |2026-08-15|`general`|| `answered` | تمام اكمل الكل |
| [R148](requests-recovered.md#r148) |2026-08-15|`ai`|| `needs-check` | اكمل كل شيا وتذكر انني ارسلت لك قليلا من الصور وهنا يجب عليك تصفح وتحليل والاستعانة بكل الادوات الازمة والاهم في كل المواقع وليس هذا فقط مع انه اضعف المواقع والاسعار اترك <br>**evidence:** payments → lib/payments |
| [R149](requests-recovered.md#r149) |2026-08-15|`ai`|| `needs-check` | اكمل كل شيئ وبحثك ضعيف لم تكتشف اهم المميزات والقدرات واقول لك نقطة ضعها قاعدة دائما كل ما اقوله لك ضعه في قائمة بكل تفاصيله حتى تنفضه ضعه في قائمة التي تم التنفيذ وهناك <br>**evidence:** agents → .claude/agents |
| [R150](requests-recovered.md#r150) |2026-08-15|`pi`|| `answered` | اكمل وهناك طلبات وتعديلات وكثير الاشياء طلبتها من اول باية المشروع استرجعها كلها مع القائمة |

---

## Restored 2026-08-20 — the gap between R151 and today

The file above stops at **R150, dated 2026-08-15**. Five days of requests were
tracked inside sessions and never written down here, which is the failure this
ledger exists to prevent: a list that stops being written is a list that stops
being a record.

What follows is that gap, reconstructed from the session record. Two honesty
notes, because a repaired ledger that hides its repair is worse than none:

- **R151–R236 are reconstructed**, not transcribed. The wording is a faithful
  summary, not the verbatim text, and it is marked `reconstructed` for that
  reason. Where the verbatim text survives it is quoted.
- **The standing rules are listed first and separately.** They are not requests
  that get closed — they are conditions on every future piece of work, and
  filing them as line items is how they got forgotten.

### Standing rules — never `done`, always in force

| Rule | Given | Text / meaning |
|---|---|---|
| S1 | throughout | **تكلم عربي دائما** — always reply in Arabic. |
| S2 | throughout | **Secrets never in files.** Keys live only where the owner can reach them; not in the repo, not reachable by contributors added to GitHub. |
| S3 | R230 | **وايضا اصلح كل الاخطاء والثغرات لما تجدها ولا تنتضر اصلحها فورا دائما** — fix every bug and hole the moment it is found. Never defer, never wait to be asked. |
| S4 | R229 | **اعمل نفسك انت الخبير وتريد ان تكون الاول في مجالك** — act as the expert. Do what was not asked for as well as what was. |
| S5 | R204 | Build each point with the newest and strongest method, **fully, the first time** — not add-then-patch. |
| S6 | charter §2.8 | Study the field continuously; every capability a competitor has, we have and better. Never copy their code. |
| S7 | charter §2a | Count sources honestly: integrations, publishers and independent origins are three different numbers. |
| S8 | this ledger | **Every request is written here, in full, before work starts** — and stays until it is genuinely delivered. |
| S9 | R265 | **One codebase, two products, no divergence.** Everything we build must work in the Pi Browser app *and* on the standalone `.com` site — launched together or one before the other, with no problem either way. Never build a surface that only one of them can run. |
| S10 | R264 | **Every page fits every screen** — phone, tablet, laptop, desktop. A page is not done until it has been checked at each width. |

### R151–R236 — reconstructed

| # | Area | Status | Request |
|---|---|---|---|
| R204 | `method` | `standing` | Implement each point with the newest/strongest methods, fully, first time. `reconstructed` |
| R215 | `pi` | `done` | One build must serve Pi Browser and the public web — decide the surface at runtime, not at build time. |
| R216 | `accounts` | `done` | A permanent, human-readable account identifier a person can read down a phone. |
| R217 | `launch` | `open` | Organise the Pi app and the public website launch professionally. |
| R218 | `globe` | `done` | Map page: fix errors, wrong information, and anything that must not be public. |
| R220 | `news` | `done` | Breaking-event highlighting, wired into the interface rather than computed and discarded. |
| R221 | `design` | `open` | Every gateway rendered in the flowing "happening now" design. |
| R222 | `design` | `open` | Categories that need more tools should have them. |
| R223 | `design` | `done` | All 22 categories reachable, not only the first eight. |
| R227 | `innovation` | `open` | More innovation, more new solutions. |
| R229 | `method` | `standing` | Act as the expert; do not wait to be told. |
| R230 | `method` | `standing` | Fix every bug and vulnerability immediately on discovery. |
| R231 | `mail` | `done` | Email registration, verification codes and password reset must actually work. |
| R232 | `mail` | `done` | Add follow-by-email with a confirmation message. |
| R233 | `pi` | `done` | In the Pi app, registration by real Pi identifier only — one button, account saved, payments live. |
| R234 | `design` | `done` | The sign-in panel must stop mixing email with Pi name/identifier. |
| R235 | `news` | `done` | News dates are wrong; everything shown is old, scattered and overlapping. |
| R236 | `design` | `done` | Full-bleed layout: the map holds the screen, data runs beside it. |

### 2026-08-20 — today, verbatim

| # | Area | Status | Request |
|---|---|---|---|
| R237 | `mail` | `done` | **يزال هناك خطا في التحقق من الايميل** — email verification still errors. Fix first. ✅ *Closed 2026-08-21: verified live end to end — `POST /api/auth/verify/request` → `{"sent":true}`. The cause was never mail; see R249–R252.* |
| R238 | `design` | `done` | **هل ترى الفرق في التصميم اجعلها مثلها** — match the design in the two screenshots exactly. |
| R239 | `design` | `done` | **اجعل المربعات اصغر وليس مستطيلات** — the boxes must be smaller and square, not rectangles. |
| R240 | `design` | `done` | **كل الفئات يجب توفر مربع خاص بها والمعلومات والاخبار تتدفق داخلها** — every category gets its own box with its news flowing inside it. |
| R241 | `markets` | `done` | **كل اللوحات الاقتصادية وكل المفقود** — every economic board, and everything missing. |
| R242 | `markets` | `done` | **لا عملات ولا كل بلوكشين ولا بورصات ولا اي شيئ** — still no companies, no blockchains, no exchanges showing anywhere. |
| R243 | `design` | `done` | **اجمع كل ماهو طبيعي … في مربع وفئة واحدة واعمل لها جزئين منها حدث ومنها تحذير** — merge every natural hazard (earthquakes, volcanoes, weather, all disasters) into ONE category and box, split into two parts: *event* and *warning*. They flood the news and overlap. |
| R244 | `sources` | `done` | **في التطبيقات المنافسة كل انواع وفئات تجلب دون توقف الاخبار حية … الا تطبيقنا كله تحذير واعادة** — competitors pull every category live and continuously; ours is all warnings and repetition. |
| R245 | `sources` | `done` | **واين الهجمات السيبرانية والاختراق والابحاث والازمات ونقص الامدادات** — where are cyber attacks and breaches, research, crises, supply shortages? |
| R246 | `markets` | `done` | **كل اخبار الاقتصاد والشركات والمصانع** — all economy, company and industrial news. |
| R247 | `innovation` | `open` | **واين تقنية الفرص والاستثمار واين تقنيات مراقبة الاستثمار او الفرص او التنبيهات** — opportunity and investment technology; investment monitoring, opportunity detection, alerting. |
| R248 | `ledger` | `done` | **واين قائمة الطلبات يجب استعادتها الان وكل الطلبات المفقودة وهذه وتبقى معك دائما** — restore the request list now, with every lost request and these, and keep it always. |

### 2026-08-21 — verbatim

| # | Area | Status | Request |
|---|---|---|---|
| R249 | `accounts` | `done` | **اتممت المهمة وجربت اختلفت الان صار عند طلب انشاء حساب وفي الضغط لارسال الرمز يقول حدث خطا** — `MAIL_FROM` was added and the behaviour changed: the form now offers email sign-up, and pressing "send code" says an error occurred. |

**R249 — what it actually was.** Not mail. `/api/health?deep=1` on the live
deployment answered `database: off`. `DATABASE_URL` was set and the database was
not answering, so `issueCode` threw inside the route, nothing caught it, and the
browser received `500` with a zero-length body — which the form could only
render as "an error occurred".

Three separate faults were fixed, each of which had independently hidden the
cause:

1. **The reason was being discarded.** Drizzle wraps every driver error, so the
   health endpoint reported its wrapper — `Failed query: select version()` — and
   the real cause sat one level down in `cause`. `lib/db/errors` now unwraps the
   chain, classifies the code, and returns the fix with it.
2. **"Configured" was standing in for "working".** Every gate read
   `isDbConfigured()`, which is true for any non-empty string. `/api/auth/methods`
   and the account routes now ask the database (`lib/db/availability`, memoised
   30s healthy / 5s failed).
3. **No route had a database-failure branch.** They now answer `503` with a
   sentence naming the cause, and never blame the visitor's input — a login
   failure caused by an outage used to come back as `401 Sign-in failed`.

| R250 | `accounts` | `done` | **اعمل الخطوة وحدك** — do the schema step yourself, rather than telling me to paste it. |

**R250 — what was built.** The Supabase tool needed an approval that did not
arrive in this session, and `DATABASE_URL` must never leave the owner's
environment (§5), so the deployment does the step instead of me.

`POST /api/admin/schema` applies the schema this build ships, from the
deployment that holds the credential, in one request — with a button on
`/setup` so it is a press rather than a command. It executes one compile-time
constant (`db/schema-sql`); no part of a request reaches the database, and it is
admin-gated on top of that.

Verified against a database rebuilt to the live deployment's exact state — 20
tables, stopped at migration 0015: first run created all four missing tables in
30 ms with zero errors, second run created nothing and stayed complete.

| R251 | `accounts` | `done` | **لم انجح باي طريقة لنسخ الكود هل هناك طريقة اخرى** — I could not copy the secret by any means; is there another way? |

**R251 — the obstacle removed rather than worked around.** Vercel stores a
variable marked *Sensitive* write-only: it cannot be revealed or copied after
saving. That was the third route to a complete schema to fail in turn — the
shell was unavailable, the nine-hundred-line paste stopped at migration 0015,
and now the operator secret could not be read back.

Three failures, one shape: the step does not belong to a person. It belongs to
the deployment, which is the only party already holding both the credential and
the schema. `ensureSchema()` now creates any missing tables on the first request
that needs an account — once per process, only when they are genuinely absent,
and only ever creating. `AUTO_SCHEMA=off` disables it.

Proved end to end against a database rebuilt to the live deployment's exact
state: a visitor pressing "send code" healed the database in 38 ms and received
their code in the same request; the next request cost 0 ms.

| R252 | `accounts` | `done` | **اكمل كل هذا وحدك** — complete all of it yourself. |

**R252 — done, and verified on the live deployment.** Opened and merged PR #46,
waited for the deploy (`a169560`), then drove the real path a visitor takes:

```
GET  /api/auth/methods        → accounts true, emailSignUp true,
                                emailSignUpOffBecause null
     (this request is what triggered the repair)
GET  /api/health?deep=1       → reachable, PostgreSQL 17.6, missing tables: 0
POST /api/auth/verify/request → {"sent":true}
```

The four missing tables were created by the deployment itself, with no secret,
no paste and no shell. R237 — open since the session began — is closed by this.

| R253 | `method` | `standing` | **اعمل كل شيئ وحدك حتى تصلح كل الاخطاء ويتفعل الايميل وكل شيئ الان انت المسؤول عن هذا وعن التطبيق والاصلاح والتطوير** — do everything yourself; you are responsible for the app, its repair and its development. |

**R253 — ownership accepted, and exercised.** Email confirmed delivered
end to end (the code reached the owner's inbox, in Arabic, not spam). Then a
full sweep of the live deployment rather than a report that it looked fine.
Four real defects found and fixed:

1. **The self-audit headline omitted its only non-zero number.** It read
   *"164 sources observed: 0 healthy, 0 degraded, 0 silent, 0 dead"* — four
   zeroes, no mention of the 164 unproven. `unproven` is now named, and
   "observed" no longer counts sources that were never measured.
2. **Three topics could not be corroborated at all** — aviation, maritime and
   procurement each had one independent origin. Added AAIB, MAIB and World Bank
   procurement notices, each verified live through the engine's own reader
   before entering the catalogue.
3. **Record fields were being published as headlines.** World Bank descriptions
   arrive as multi-line paragraphs; `headline()` now normalises at every claim
   site — the general form of the "0.821" defect.
4. **Non-UTF-8 feeds were silently corrupted.** Folha declares ISO-8859-1 inside
   the document and sends no charset header, so every accented Portuguese
   headline was stored as mojibake (`reduz �s redes`). `decodeBody()` honours
   the declared encoding; header wins, then XML declaration, then meta.

Also: the audit script now applies the same normalisation the product does — an
audit that reports what the product would never publish is measuring the
instrument — and the adapter's test double is a real `Response` instead of an
object shaped like the two methods it happened to call.

### 2026-08-21 (evening) — verbatim

| # | Area | Status | Request |
|---|---|---|---|
| R254 | `markets` | `done` | **مع الاقتصاد والبورصات ضف كل مايجب ان يكون في تطبيقنا من فئات وبوابات** — with economy and exchanges, add every category and gateway the app ought to have. |
| R255 | `markets` | `done` | **يجب ان يكون كل شيئ مرفق بكل معلوماته والاسعار والحالة وكل شيئ والتتبع وكل البلوكشين بكل المعلومات والاسعار** — everything carries its full information: prices, status, tracking; and all blockchains with all information and prices. |
| R256 | `design` | `done` | **يجب عرض بطريقة احترافية ومرتبة** — present it professionally and in order. |
| R257 | `design` | `done` | **المربعات في صفحة الخريطة كانها متداخلة مع بعض اجعل لها تصميم احترافي عالي كل واحدة مميزة وغير متداخلة كانها صفحة واحدة** — the boxes on the map page look interlocked; give each a high professional design, distinct, not overlapping, as one page. |
| R258 | `news` | `done` | **عالج امر الاخبار ازعجني الاخبار كلها ارصاد وتحذيرات جوية متنوعة** — fix the news: it is all meteorology and assorted weather warnings. |
| R259 | `design` | `done` | **المعلومات والبوابات تحت الخريطة غير مرتبة والاسوء بيانات وهمية وغير واضحة لا تصلح ولا يستفيد ولن يفهمها اي مستخدم مهما كان نوعه وخبرته** — what sits under the map is disordered, and worse, **fake and unclear data** that no user of any kind or experience will understand or benefit from. |
| R260 | `sources` | `answered` | **هل وصل مصادرنا 200000 مصدر** — have our sources reached 200,000? |
| R261 | `design` | `done` | **المعلومات والاخبار على الخريطة غير مفهومة وغير مدعومة لتوضع طبيعة اختصاصها** — the information and news on the map are not understandable and not labelled with the nature of their specialism. |

**R259 is a charter breach if true.** §2 rule 1 forbids mock data outright. It is
investigated first, ahead of every other item here.

**R258 — the cause, found and fixed.** The news was all weather because
**39 of 208 enabled feeds are one publisher**: EUMETNET's MeteoAlarm, read
through one feed per European country. The catalogue already grouped them
honestly for §2a, but `diversify` capped on `sourceKey`, so MeteoAlarm cleared
the per-publisher cap thirty-nine times over. `Rankable.origin` now carries the
independence group and `maxPerOrigin` caps on it, on all four surfaces — with a
test that fails if any surface forgets.

**R260 — the honest count, per §2a.**

| Tier | Count |
|---|---|
| **Integrations** (feeds we call and parse) | **227** catalogued, 208 enabled |
| **Independent origins** (what a confidence grade may count) | **149** |
| **Publishers** (outlets reachable *through* an integration) | millions — GDELT alone indexes ~100,000 outlets |

So: **no**, we have not reached 200,000 *sources*, and we never claimed to.
227 integrations. Quoting the publisher tier as a source count is precisely the
dishonesty §2a exists to forbid.

**R261/R259 — unreadable rows.** 37 of 4340 live events carried a headline
that stated nothing: 31 bare Japanese sea areas from JMA, 4 NASA event codes,
2 coin tickers. `lib/analysis/legible` restates only what the record already
carries — the category and the measurement — so `八丈島東方沖` becomes
"Earthquake M4.7 — 八丈島東方沖" and `CME` becomes "Coronal mass ejection (CME)".
It never translates, never locates, never invents.

**R257 — interlocked boxes.** The rail was a `gap-px` grid with rows forced to
an equal share of the height, so twelve subjects were crushed to one headline
each and the hairlines read as table rules. Now real cards: own height, gap,
border, rounded, scrolling.

**Still open: R254/R255** — the economy, exchanges and blockchain depth. Not
started; called out rather than quietly counted as done.

**R258 — the true cause, found by measuring rather than reasoning.** My first
diagnosis (MeteoAlarm's 39 feeds slipping past a per-feed cap) was a real defect
and **not** what the owner was seeing: measured against live data, MeteoAlarm
reached 0 rows either way. The actual cause was the **backfill**. The caps
correctly held the US National Weather Service to 3 rows — then `diversify`
filled the remaining 17 slots from the overflow, which was almost entirely NWS
flood warnings. The rule was applied and immediately handed back.

Backfill now runs under caps relaxed by a factor of two rather than under none.
Same live data, natural-hazards box:

| | before | after |
|---|---|---|
| rows | 24 (17 backfill) | 14, across 5 publishers |
| NWS flood warnings | 20 | 6 |
| the box read | Happened 4 · Warned 20 | Happened 8 · Warned 6 |

A test that asserted the *old* rule — "backfills from the overflow rather than
returning a short list" — was the bug written down, and has been replaced.

**R254/R255 — the work was never to collect this. It was to show it.**

The chain radar had been producing all of it for some time: four networks with
height, fees, congestion, throughput and supply; capitalisation, volume and
dominance; movers with prices; twenty-five exchanges with volumes, shares,
jurisdictions and trust scores. The only consumer was a map layer that wanted
the coordinates, so everything else was computed and thrown away — which is why
the honest verdict was *"لا عملات ولا كل بلوكشين ولا بورصات ولا اي شيئ"*.

**Markets & chains** is now a tab of its own, and had to earn the sixth slot
against the rule in `lib/navigation.ts`: a tab must answer a question a user
arrives with and lead somewhere real. The tab-count test was rewritten to assert
the property that actually matters — every tab still clears the 44px minimum
touch target at 320px — rather than a magic `<= 5`.

Three defects were found by rendering it against live data and looking, and all
three were fixed before it shipped:

| Seen | Cause | Fix |
|---|---|---|
| `BTC dominance 5931.1%` | the source publishes `59.31`, already a percentage, and it went through `share()`, which multiplies by 100 | a separate `percent()`, and a test that a dominance can never print above 100% |
| "100 venues counted" beside "15 largest of 25" | two true numbers on one card, contradicting each other | the index is stated as measured across 100; the table says it lists 15 of the 25 returned |
| `FIGR_HELOCFigure Heloc` | a ten-character ticker in a `w-14` column | wider column, truncating |

Every figure carries the agency that measured it and when (§6). Where a chain
publishes no congestion measure the card says so, rather than drawing an empty
bar — inventing a measurement is the same failure as printing `0` for "not
reported".

| R262 | `markets` | `done` | **اكمل بكل تفاصيلهم والمعلومات وايضا ضم ماتبقى** — complete them with all their detail and information, and include what remains (the traditional exchanges: equities, bonds, currencies). |

**R262 — the traditional side, from the institutions that set it.**

Added, each probed live before it was written down:

| | Source | Live now |
|---|---|---|
| Sovereign yields 2Y/5Y/10Y | ECB euro-area yield curve (SDMX) | 2.791% / 2.934% / 3.279% |
| Policy rate | ECB main refinancing rate | 2.400% |
| Reference exchange rates | ECB daily fixing via Frankfurter | 10 currencies per USD |

The **2s10s spread** is the one number computed rather than read, and it earns
that: it is the question the two yields exist to answer together, and its sign
is stated in words rather than left as a subtraction for the reader.

**Equity index levels are absent, and that is a finding rather than a gap in
effort.** Index levels are licensed intellectual property — S&P owns the S&P
500's values, Deutsche Börse owns the DAX's. Stooq answered 404, ECB's FM
equity series 404, Bundesbank 406. The unofficial endpoints that do exist are
scrapes of a broker's site in breach of its terms, which §3 forbids. The honest
answer is that this category needs a licensed feed, and to publish nothing
rather than something we had no right to take.

**One bug worth recording.** The yield curve first made three requests, one per
tenor, and the engine dropped the whole source in silence: a source declaring
`minIntervalMs` is rate-limited against its own previous call, so the second and
third fetches inside a single run were refused. It worked perfectly when run by
hand — which is exactly how that class of bug survives. Now one request for all
three, matched by the dimension id the API returns rather than by position:
`SR_2Y+SR_5Y+SR_10Y` was requested and `["SR_10Y","SR_2Y","SR_5Y"]` came back,
so reading by position would have labelled the ten-year yield as the two-year.

| R263 | `i18n` | `done` | **الترجمة اجعل ترجمة جوجل مباشرة متوفرة في مشروعنا ليكون فيها كل اللغات العالمية** — make Google Translate directly available so the project carries every world language. |
| R264 | `design` | `done` | **لما تصل للتصميم ايضا الصفحات الاخرى اجعلها ملائمة للحاسوب او الهواتف او تابلات او غيره** — when the design work is reached, make the other pages fit desktop, phones, tablets and anything else. Recorded as standing rule S10. |
| R265 | `platform` | `done` | **لااعرف هذا الامر كيف يعمل خاصة مع امر اننا نعمل على تطبيق لبراوزر الباي نتورك وموقع كوم في نفس الوقت ارجو ان كل عملنا متوافق ودون مشاكل حين نطلق العمل على التطبيق والموقع مع بعض او واحد قبل الاخر تذكر هذه القاعدة جدا** — explain how the one-codebase / two-products arrangement actually works, and guarantee that everything we build runs in the Pi Browser app and on the `.com` site, released together or one before the other. Recorded as standing rule S9. |

**R263 — every language, and the bug that was eating the seven we wrote by hand.**

The request was to open the product to every world language. The blocker was not
coverage, it was collision. `components/auto-translate.tsx` walks every text node
after render and translates it — which is right for engine content and wrong for
a label the dictionary had *already* translated on purpose. Arabic was being
translated twice, from Arabic:

| Key | We wrote | The second pass produced |
|---|---|---|
| `nav.home` | `الرئيسية` | `فور` |
| `nav.preferences` | `الإعدادات` | `جحيم` ("hell") |
| `nav.monitor` | `مراقبة` | `حمى` ("fever") |
| `mk.movers` | `Movers` | `شركات نقل الأثاث` (furniture removal companies) |

`lib/i18n/translate.ts` already stated the rule — *a hand-written string always
wins over a machine one* — but the DOM sweep runs after render, so the rule was
true in the module and false on the screen.

**The obvious fix is half a fix.** Marking those nodes `data-no-translate`
protects the seven curated languages and freezes the other hundred in English
permanently — the exact opposite of the request. So the shield is *conditional*:

- `SUPPORTED_LOCALES` — ~110 languages, each labelled by its **endonym**
  (`Deutsch`, `日本語`, `فارسی`), because a speaker scans the list for how they
  write their language, not for what English calls it. RTL now covers
  ar/he/fa/ur/ps/sd/ug/yi/dv/ckb, not Arabic alone.
- `isCurated(locale, key)` lives in `lib/i18n/dictionaries.ts`, beside the data
  it reads — a pure lookup a server component, a script or a test can ask
  without loading React.
- `<Label k="…" />` shields itself only when the current language actually has
  the hand-written wording. Turkish keeps machine translation; Arabic keeps its
  own words.
- A finance glossary (20 `mk.*` terms) in all seven curated dictionaries, because
  the isolated two-word label is exactly where machine translation fails —
  `Movers` had no sentence around it to disambiguate.

`lib/i18n/shield.test.ts` holds the condition in place, including a source scan
asserting that **no component hard-codes a bare `data-no-translate`** on a
translated label. That test is the one that would have caught the half-fix.

**R264/R265 — the two-surface promise, and what measuring found behind it.**

R265 was a question before it was a request: *how does one codebase serve the Pi
Browser app and the `.com` site at once?* `docs/ONE-CODEBASE.md` is the full
answer. In short: one repository, one build, one deployment, reached through two
front doors. Only sign-in and payment differ, and both are decided **where the
visitor is** rather than when the code was built — so the site and the app can
launch together or in either order with nothing to migrate.

That answer was two-thirds true when it was written. Sign-in already worked this
way; **payments did not.** `PAYMENT_PROVIDER` is read at deploy time, so one
deployment could only ever take one kind of payment: set to `pi`, nobody on the
website could buy anything; set to `standard`, no pioneer could pay with π. The
rail now follows the payer (`lib/payments/rail.ts`), and
`lib/platform/parity.test.ts` fails the build if that ever slides back.

R264 asked for every page to fit every screen. Measuring 10 pages at 6 widths
found no horizontal overflow anywhere — and three real defects that no amount of
looking at a laptop would have shown:

| Found | Why it mattered |
|---|---|
| The globe's five layer buttons dropped their labels below 640px | A phone reader saw five unlabelled glyphs, and the sentence beneath names only the *selected* layer. Worse for readers who never met this icon set, which is most of ours. The row scrolls now. |
| The sign-in card stood 180px tall, `fixed`, on a 640px phone | 28% of the screen, permanently covering the product, until the small × was found. One line on a phone now; the full card from `lg` up. |
| Controls of 16–28px where a finger needs 44 | `.touch-target` grows the *touch* area on coarse pointers only, so the desktop look is untouched and the guideline is met. |
| The tab bar sat under the phone's home indicator | No safe-area inset and no `viewportFit: 'cover'`, so the insets read 0. Pi Browser is a mobile webview — this is the app's primary surface, not an edge case. |

**Two bugs the audit found that were not about layout at all**, and would not
have been found without it, because both leave a page looking perfectly correct:

- **React #418 on every tab URL.** The shell read `window.location.pathname` in
  a `useState` initialiser and fell back to `'feed'` on the server, so `/globe`
  prerendered the feed and hydrated the globe. React threw the server HTML away
  and rebuilt the whole document on the client — every deep link, including on a
  phone in Pi Browser. The route already knows the tab; it is passed in now.
- **A build stamp that was not a build stamp.** `next.config.mjs` set
  `NEXT_PUBLIC_BUILT_AT: new Date()`, and that file is evaluated once per
  *process* — so `next start` and every serverless cold start ran the clock
  again. The footer reported when the server booted, and the two sides of every
  page disagreed on a piece of text. It is a generated constant now
  (`lib/build-stamp.ts`), compiled identically into both bundles.

The audit itself was wrong first, and that is the lesson worth keeping: its first
version reported the crashed pages as **ok**, because a page that fails to render
has no horizontal overflow either. It now treats a page error or a failed asset
as the loudest finding it can report. `npm run audit:responsive`.

| R260 | `dossier` | `studied` | **اختار سهم أو عملة أو أي شيء … كل أخبار وأحداث وشراكات وخطط وأعمال من المصادر الرسمية … مع معلومات وإعلان الشريك … والمصادر … والأثر أو الاستنتاج … وأي شيء يعلن يذهب مباشرة إلى لوحة** — plus the classes still missing entirely: companies, all raw and processed materials, gold, silver, everything traded. Asked for as a **study before implementation**, awaiting development of the idea. |

**R260 — the study, delivered: `docs/DOSSIER.md`.**

The thesis in one line: every platform in this field aggregates **coverage** —
what journalists and other aggregators said. We index the **primary act**: the
8-K the company itself filed, the proposal its own holders voted, the auction
price its own benchmark administrator set. Then we resolve the *counterparty*
named in it to a real entity in our graph, extract the *terms*, and state the
*consequence* with a grade on it.

Every source in the plan was probed live on 2026-08-21 rather than assumed:

| Verified | Result |
|---|---|
| SEC `data.sec.gov/submissions/CIK…json` | `200` — name, tickers, exchanges, EIN, **LEI**, SIC, addresses, former names, full filing index |
| GLEIF LEI records | `200` |
| **LBMA gold/silver auction prices** | `200` — 14,666 daily rows, latest 2026-08-20 at **$4,482.95/oz**. This closes *الذهب والفضة* with the actual benchmark, not an aggregator |
| CoinGecko `/coins/{id}` official links | `200` — homepage, announcement URL, repos, handle: a *read list* of the issuer's own mouths |
| Governance forums `/latest.json` | `200` |
| World Bank / FAO / USGS | `200` |
| Companies House · EIA · OPEC | `401` / `403` — keyed or blocked; two may be our egress and need re-checking from production |

**Equity and index prices stay absent, deliberately.** Yahoo's `query1` endpoint
answers `200` and we are not going to use it: it is a scrape of a broker's site
in breach of its terms, and §3 forbids that route. SEC XBRL gives audited
fundamentals lawfully and free, so a company dossier is rich without one price
tick.

Five additions beyond the ask, each cheap for us and expensive for anyone else
because each depends on machinery this project already has: the **provenance
ladder** on every official channel (A–C, how we know the mouth is theirs);
**counterparty resolution** as a first-class graph edge; the **silence signal**
(an issuer that files every eleven days and has filed nothing in ninety — no
competitor reports absence, because absence has no press release);
**contradiction between primary sources**; and the **dossier seal** for export.

Ten phases, ordered by what unlocks the most rather than by what is easiest, and
four open questions put back to the owner — depth versus breadth, how far
counterparty resolution recurses, whether to take the keyed sources, and which
reader the default section order serves.

| R267 | `standing` | `standing` | **لنا أكثر من المواقع والتطبيقات المشابهة — ننقل خبرتهم وكل ما نحتاجه وكل ما هو ملمّ ومفقود في مشروعنا، ونحلّ كل مشاكلهم بطريقتنا وتفوّقنا: التصميم والترتيب وكل تقنياتهم وأدواتهم. كل ما هو موجود في المشاريع المنافسة يجب توفّره عندنا مع التطوير والتحسين والابتكار وحلّ المشاكل، وأيضًا ابتكاراتنا ومميّزاتنا وكل ما يجعل مشروعنا الأول في مجاله ويخدم كل الفئات والأعمار والخاص والحكومي. وبتجربة وتصفّح حقيقي وعمل حقيقي، وكأنك إنسان خبير جدًّا على المشاريع المشابهة.** |

**R213/R179 (جزء) — بوّابة التحقّق: هل فُحص هذا الادّعاء أصلًا؟**

`media` كان يتحقّق من **الأثر** — بيانات الصورة، أثرها العكسي، بصمات التوليد.
النصف الآخر من §2.13 في المرجع — *هل فُحص هذا الادّعاء، ومَن فحصه* — لم يكن
موجودًا **إطلاقًا**، لا ضعيفًا. الآن `verify`: خمسة ناشرين من موقّعي IFCN
(Snopes · Full Fact · PolitiFact · FactCheck.org · Lead Stories).

**ما يميّزها عن قائمة روابط:** البحث عن موضوع يُخبرك **كم فاحصًا مستقلًّا**
تناوله — بعدّ مجموعات الاستقلال لا العناوين، وهو انضباط §2a مطبَّقًا حيث يهمّ
أكثر. تحقّق حيّ ٢٠٢٦-٠٨-٢٢ على "video": **٤ فاحصين مستقلّين، ١٥ فحصًا**.

**وما ترفض فعله، وهو نصف قيمتها:** لا تجمعهم في **حكم**. ثلاثة فاحصين تناولوا
ادّعاءً ليسوا ثلاثة تأكيدات لأيّ إجابة، والتحذير مكتوب **داخل الصفّ نفسه** لا
في توثيق لا يفتحه أحد. ولا **تخمّن** تقييمًا: واحد فقط من الخمسة (Lead Stories)
يذكر نتيجته في التغذية، فتُعرض؛ والأربعة الباقون يقولون *الحكم على الصفحة* مع
الرابط. استنتاج «كاذب» من عنوان يبدأ بـ«لا،» صحيح بما يكفي ليُوثَق به وخاطئ بما
يكفي ليكون خطِرًا — وهذا أسوأ اجتماع ممكن.

**وعطل ظهر حيًّا فأنتج إصلاحًا عامًّا في المحرّك.** مداخل الموسوعة عند
FactCheck.org كانت تُعرض كفحوص — «Americans for Prosperity» كأنها تفنيد.
التصنيف موجود في `<category>` وكان محلّل التغذية **يُسقطه**، فمرشّح يقرأ العنوان
والملخّص نجح في اختباره ولم يفعل شيئًا على البيانات الحقيقية. الآن
`FeedEntry.categories` يحمل تصنيف الناشر نفسه — يستفيد منه **كل** مصدر في
الكتالوج — والاختبار الذي يحرسه يمرّ عبر `parseFeed` لا حوله.

**R267، الأثر الثاني: الطيّ عند العرض — إصلاح واحد يقصّر كل لوحة ستوجد.**

بعد إصلاح البحرية، بقيت ملاحظة من نفس المشية لم أتجاوزها:

| الصفحة | طول الهاتف |
|---|---|
| العملات الرقمية | **١٢٬٩٠٢px** |
| التحقّق | **١٢٬٢٣٣px** |
| *صفحة الكرة التي وُصفت بأنها غير صالحة* | *١١٬٤٣٩px* |

كلتاهما **أطول** من الصفحة التي عوتبت عليها، وبياناتهما سليمة. السبب أن كل
مجموعة تعرض كل صفوفها دائمًا؛ وعلى الهاتف هذا عمود واحد من كل شيء.

**وقرار المكان هو جوهر الإصلاح.** الحدّ داخل كل مصدر — كما فعلتُ للبحرية —
يكلّف القارئ صفوفًا قد يريدها، **ويجب تذكّره مع كل بوّابة يضيفها أحد لاحقًا**.
الطيّ عند العرض تغييرٌ واحد يقصّر **كل** لوحة ستوجد، لا يحذف شيئًا، ويترك
الاختيار للقارئ: ستّة صفوف تُظهر شكل المجموعة، والباقي بضغطة تحمل **عدده
الحقيقي** — لأن «أظهر الـ٧» و«أظهر الـ٣٨٥» عرضان مختلفان.

ولا يلغي هذا شرائح R266: **أيّ المجموعات أشاهد** و**كم أقرأ من مجموعة** سؤالان
مختلفان، والاختبارات تحرس كليهما.

**R267 أثبت نفسه في أوّل تطبيق له: صفحة البحرية كانت ٦٤٬٠٥٦ بكسل.**

بعد بناء ثلاث بوّابات وتحقّقي من **بياناتها** حيًّا، فتحتُها في متصفّح حقيقي على
هاتف وحاسوب — لأن R267 يقول إن التصميم والترتيب **قدرة**، وإن ادّعاءً عن الواجهة
يُفحص في متصفّح. النتيجة:

| البوّابة | طول صفحة الهاتف | أهداف اللمس |
|---|---|---|
| العملات الرقمية | ١٢٬٩٠٢px | ٥٩ |
| التحقّق | ١٢٬٢٣٣px | ١٨ |
| **البحرية** | **٦٤٬٠٥٦px** | **٧٣١** |

**خمسة أضعاف ونصف** صفحة الكرة التي قلتَ عنها إنها غير قابلة للاستعمال. ٣٨٥ صفًّا
في مجموعة الأطلسي وحدها. **البيانات كانت سليمة تمامًا والصفحة غير صالحة** — وهذا
بالضبط الفرق الذي يقيسه R267: كل لوحة أخرى في الكود تحدّ عدد الصفوف في المصدر
(١٥ إلى ٣٠٠)، ومصدري كان الشاذّ الوحيد الذي يُخرج الـ٨٦١ كلها.

الآن كل محيط يعرض **أعنف عشرين**، و**يَعُدّ ما استُبعد على الصفحة نفسها**: حدٌّ
لا يراه القارئ لا يُفرَّق عن تغطية ناقصة. النتيجة **١٠٬٧٦٧px** و**٧٨ هدف لمس**.

ولاحظ الفرق: هذا العطل **لم يكن ليظهر في أيّ اختبار وحدة** — ٢٬١٥١ اختبارًا كانت
تمرّ وهو موجود. ظهر لأنّي فتحتُ الصفحة.

**R267 — قاعدة دائمة، لا بند يُغلق.**

This is §2 rule 8 restated by the owner, and it is recorded as `standing`
rather than as a task precisely because it can never be "done". Four things it
adds to how the work is judged, from now on and without being asked again:

1. **Parity is the floor, not the goal.** Every capability a competing platform
   has, we have — and better. Their weaknesses are our specification. The
   living record is `docs/COMPETITORS.md`; the gap list that turns it into work
   is `docs/GATEWAY-MAP.md`.
2. **Design and arrangement count as capability.** "It is in there somewhere"
   is the failure this project keeps being told about — R266's globe page,
   R181's buried GDP figure, R185's asset record landing seventh. A finding a
   reader cannot find is a finding we do not have.
3. **Real browsing, real work.** A claim about the interface is checked in a
   real browser at real viewport sizes before it is made. `user-walker` and
   `scripts/responsive-audit.mjs` exist for this; "it should work" is not a
   verification.
4. **Every audience.** Private and government, every age, every device. That is
   why the two-surface guarantee (R265) and the fit-every-screen rule (R264)
   are enforced by tests rather than by intention.

What it does **not** change: §2 rule 8's last line. We study their
architecture, we never copy their code — most are proprietary, and World
Monitor is AGPL-3.0, which would force our whole product open.

| R266 | `globe` | `done` | **تصاميم الصفحات لا تزال بدائية، وفي صفحة الخريطة اجعل المربعات بطريقة يمكن تحديدها وفرزها واستعمال واضح وتمرير الصفحة — المربعات الآن تبدو صفحة واحدة متداخلة. وتحت الخريطة حتى آخرها المستخدم يتشتت، وتوزيع وتصميم المعلومات وفرزها لن يفهمه ولا يعرف المستخدم العمل عليه. وهناك أخطاء بالمعلومات والتواريخ، وأيضًا فوق الخريطة.** |

**R266 — measured first, then rebuilt, then measured again.**

The globe page was **11,439 pixels tall**. Past the map came a ranked list, an
unplaceable list, a fusion count, 167 source names in a column, the *same 159
names again* inside a paragraph, twelve shipping corridors each printing a full
sentence to say nothing happened, and three country bands each saying "No
country currently falls in this band." Almost none of it was information — it
was the *absence* of information rendered at the size of information, which is
exactly what makes a person say they cannot tell how to work a page.

| | Before | After |
|---|---|---|
| Desktop | 11,439px | **5,851px** |
| Phone | — | **3,214px** |

**Times that disagreed with each other.** The same advisory read `3h old` in one
list and `2 hours ago` in another, because `humanHours` rounded and
`lib/ui/time` floored. The brief printed `The picture reaches back is 23 hours
old` — two verbs — and `1 hours old`. All three were live. Both clocks floor
now, and a test compares them against each other's arithmetic rather than
against fixed strings.

**Counts that read as errors.** `0/10` beside a green dot with no units, over an
empty map, is a riddle; it says `0 of 10 on the map` now. `0 of 0 shown` sat
directly above ten events listed below it — both numbers counted *plottable*
events and were right, but the sentence never said which population it counted.

**Then four workspaces** — Map, Brief, Countries, Categories — because those are
four questions, not four sections of one document, and a reader arrives holding
one of them. All four read one shared world picture, so switching costs no fetch
and the tab counts can be trusted before the panel opens.

**The other tabs were measured with the same instrument and are already sound:**
markets 1,430px, investigate 1,339px, monitor 900px, feed 3,728px. The globe was
the outlier, which is why it was the one to fix first.

Two things the audit got wrong, recorded because the lesson is the point:

- Its first version reported **crashed pages as "ok"**, since a page that fails
  to render has no horizontal overflow either. It now treats a page error or a
  failed asset as the loudest thing it can say.
- Its repeat-detector flagged the home ticker as duplicated content. It is not:
  `[...items, ...items.slice(0, rows)]` is the standard seamless loop. Measuring
  finds candidates; only reading the code decides which are defects.

## Reconciliation, 2026-08-21 — the ledger was the thing that was broken

The owner said the work was not moving and that requests had disappeared without
trace. That deserved an audit rather than reassurance, so every row marked
`open` was checked against the code.

**Thirty-four of them were already built.** Not partly — shipped, tested and
merged, with the ledger row never flipped. A sample of the evidence:

| # | Claimed open | Actually in the code |
|---|---|---|
| R209 | pick 1–5 gateways for the home page | `Pin gateways to this page` in `components/` |
| R198 | Google Translate, every language | `SUPPORTED_LOCALES` — ~110 locales |
| R169–R171 | FX, blockchain, crypto detail | `referenceRates`, `chain_state`, `coingecko_trending` |
| R215/R233/R234 | Pi identity, one button, no email mixing | `lib/auth/environment.ts` — `offerFor`, `pi-browser` |
| R235/R218 | wrong news dates, wrong map information | `describeSpan`, floored clocks, both tested |
| R257/R259/R264/R265 | interlocked boxes, unsorted, screens, one codebase | `PanelSection`, `SectionIndex`, safe-area insets, `docs/ONE-CODEBASE.md` |
| R203 | the deployment zip | `scripts/package.mjs` |

| | before | after |
|---|---|---|
| recorded | 138 | 138 |
| open | **65** | **30** |

**This is my failure, and it is worth naming precisely.** The rule in §8 is that
every request is written here before work starts — and I kept that half. I wrote
them down and then did not close them, so the ledger accumulated finished work
labelled unfinished. Anyone reading it, including the owner and including me,
would conclude nothing was progressing. The work was real; the record of it was
not.

Closing a row now requires the same thing opening one does: evidence. Every
flip above names the file that proves it.

### What is genuinely left — thirty, in four groups

**Gateways, the largest block** (R179, R180, R181, R183, R185, R187, R212, R213):
research and add every remaining gateway family — exchanges and equities of all
kinds, company and national economies, state and private industry, the full
crypto/blockchain picture, and a researched list of what is still missing.

**Automation** (R184, R189, R152): gateways that run and evolve by themselves;
continuous auto-publishing.

**Innovation** (R201, R227, R247, R200): our own inventions rather than parity —
opportunity and investment tooling, and OSINT tools that return real findings.

**Presentation and launch** (R190, R220, R221, R222, R223, R224, R166, R217,
R160): every gateway in the "happening now" design, category tools, big-event
banner, the globe carrying every gateway, launch organisation, and the ~13s
route settle time.

R204 and R229 are standing rules, not items to close.

**R185 — الأصول كانت عشرة، والأخبار كانت صفرًا.**

I checked the code before writing any, as R180 taught. What was there: four
chains read from their own nodes, Bitcoin's mempool, and the **top ten** coins
by market capitalisation. What was not there, and was not there *at all*:

1. **The other 18,600 assets.** Ten of eighteen thousand is a leaderboard, not
   coverage. Anyone asking about the asset they actually hold got nothing.
2. **The record itself.** Supply against its cap, the distance from the
   all-time high, which chains an asset runs on, what it is classified as —
   none of it existed anywhere in the product.
3. **Crypto news.** Not a thin feed: none. Zero words about any of it.

The gateway `crypto` now answers all three, and it cost one board row plus two
sources — no route, no view, no branch, because the board shape from the seven
earlier gateways held. Verified live on 2026-08-22: `pi network` returns
**19 rows** — price $0.0973 (+6.95% 24h), rank #70, 11.09B PI in circulation
against a 100B cap (11.1% issued), all-time high $2.99 on 2025-02-26 and now
96.7% below it — beside **78 headlines from all seven publishers**, every one
dated by its publisher.

**Counting honestly (§2a).** Two integrations. 18,610 assets is *reach* through
one of them and is never a source count; CoinGecko is **one** independent
origin however many assets it covers, which is why a price here is graded B and
a chain reading from the network's own node is graded A. Four of the seven
publishers are the networks announcing their own decisions — an A — and three
are the specialist press at C, kept because a network's own blog will not tell
you the network is being sued.

**Three real defects surfaced while building it, all fixed.**

*The search returned the biggest, not the best.* CoinGecko answers `pi` with a
euro money-market fund first, because that fund is larger than Pi Network. That
is the exact bug the exchange register had a day earlier, and the fix belongs in
our code, not the provider's: `coinRelevance` ranks the **kind** of match —
exact ticker, exact name, prefix, whole word, substring — and only uses size to
break ties.

*A throttled provider reported itself healthy.* `if (!res.ok) return []` made a
429 indistinguishable from "nothing to say", so the board would show *2 sources
ok* while missing half its answer. Now it throws through `fetch-guard`, and the
count says one failed, because one did.

*Which led to a general engine fix.* The source cache was consulted only when
**we** declined to fetch, never when the **provider** fell over — so a
ninety-second-old answer sitting in memory was thrown away on a 429. It is now
served on any failure, with `ok: false` and the error kept, because a product
that serves stale data and calls itself healthy is lying about its own
reliability. This helps every source in the platform, not the crypto one.

*And the answer arrived seventh.* The board orders groups by size, which is a
good default until a board answers a **specific** question: seven rows about the
asset landed beneath seventy headlines about the sector. A source may now
declare where its groups belong; every board that declares nothing keeps exactly
the old order.

**R180 — «كل البورصات» كانت مبنيّة، والخطأ كان أن أبنيها مرّة ثانية.**

The register was already there. `lib/engine/sources/venues.ts` reads **ISO
10383** — the register SWIFT maintains that assigns a Market Identifier Code to
every regulated market, multilateral trading facility, systematic internaliser
and off-book venue on earth — caches it, and fails loudly rather than reporting
an empty register as a healthy one. A separate crypto-venue source sits beside
it, labelled a market index rather than a registry, because presence in an
aggregator is not registration by an authority.

Verified live on 2026-08-21: **2,875 rows — 1,589 operating venues, 1,286
market segments inside them, across 149 countries, 2,246 carrying a LEI.** Those
numbers are reported separately and never added, per §2a: NYSE Arca is a market
inside the New York Stock Exchange, not a second exchange.

I began writing a second implementation of this before checking, and stopped
when the existing one surfaced. The duplicate was deleted. **That near-miss is
the reconciliation lesson repeating itself:** the row said `open`, so I believed
the work was missing. Reading the code first is the cheaper habit.

**What the check did find is a real relevance bug, now fixed.** Searching the
live register for `TOKYO` returned three Bank of America dealer desks above the
**Tokyo Stock Exchange** — all four sit in Tokyo, all four matched, and `B`
sorts before `T`. The filter was generous, which is right, and the order was
alphabetical, which is not relevance; it only looks like relevance when the
first answer happens to be right. `venueRelevance` now ranks the kinds of match —
exact code, country code, name prefix, whole word, substring — and the venue a
query *names* outranks one that merely sits in that city. The query is escaped
before it reaches a regular expression, so a reader typing `(` gets results
rather than an error.

**R181 — the country data was there; nobody could reach it.**

Company economics were already built: SEC XBRL profiles, the assets ranking
across 6,110 filers, ownership. National economies were built too —
`lib/engine/sources/economy.ts` reads the World Bank and is wired into the
markets gateway. Verified live: **Germany GDP $5.05T, population 83.5M,
inflation 2.2%; Saudi Arabia $1.28T, 37.0M, 2.1%** — all current-year.

**And a reader would never have seen any of it.** There was no ordering in the
gateway at all: findings came out in whatever order the sources happened to
answer in. Searching "Germany" led with an **E.ON filing from 2002**, then
Allianz from 2002, then a Greek shipping company that mentions Germany. The
GDP figure was sixth. "Saudi Arabia" led with two American ETF prospectuses.

That is the shape of every "the tools give me nothing" report: the data is
right, it is present, and it is below the noise. For the reader those are the
same thing as not having it.

`rankFindings` applies two rules, in order. **What the subject *is* beats what
merely mentions it** — a country's own measured economy answers "Germany"; a
filing containing the word is a mention, and full-text search is the widest net
in the gateway. **Recent beats ancient** — a 2002 filing is not evidence about a
company now. Nothing is deleted: someone researching 2002 still finds it, it
simply stops being the first thing everyone else sees. The sort is stable, so
evidence it cannot separate never reshuffles between runs.

| Searching "Germany" | before | after |
|---|---|---|
| 1st | E.ON filing, 2002 | **GDP $5.05T (2025)** |
| 2nd | Allianz filing, 2002 | Population 83.5M |
| 3rd | Greek shipping company | Inflation 2.2% |

One correction worth recording: my first measurement of this reported "0
findings" for both countries and I nearly filed it as a bug. The gateway
returns `findings`; my probe read `evidence`. The tool was wrong, not the app —
the same lesson as the audit that called crashed pages "ok".

**R183 — the economy source knew how big a country was and nothing about what it makes.**

Three indicators: GDP, population, inflation. That answers "how large and how
expensive" and stops. A reader asking about a country's **industry**, its
**factories** or the size of its **private sector** got nothing — not a gap in
the data, a gap in what was ever requested. The source also had **no tests at
all**, which is how it stayed that way without anything saying so.

Nine indicators added, each requested live before it was written down and each
answering with a current figure:

| | Germany | Saudi Arabia |
|---|---|---|
| Manufacturing, share of GDP | **17.6%** | **15.8%** |
| Industry incl. construction | 25.2% | **43.0%** |
| Services | 64.5% | — |
| Credit to the private sector | 77.3% | — |
| Unemployment | 3.7% | 3.0% |
| GDP per person | $60,496 | $34,537 |

Saudi Arabia's 43% industry against 15.8% manufacturing is the oil sector, and
the contrast between those two numbers is itself the finding — which is the
argument for shares of GDP over absolute figures: they compare between
countries of wildly different size.

**Twelve indicators, one request.** It was one request per indicator, which was
survivable at three and rude at twelve — and is the exact shape of a bug this
codebase already paid for in the ECB yield curve, where a source declaring
`minIntervalMs` had its own fan-out silently refused and produced nothing while
looking healthy. The World Bank answers `indicator/A;B;C` in a single response,
and figures are matched to indicators **by id, never by position** — the other
half of that same lesson.

Live: Germany went from 3 findings to **16**, Saudi Arabia to 15.

---

## R267 — المشية الكاملة: ما لا يستطيع أي اختبار رؤيته

المشية على هاتف ٣٩٠px، الثلاث والثلاثون بوّابة، على خادم إنتاج حقيقي.

### النتيجة

| | قبل | بعد |
|---|---|---|
| أطول صفحة | **٩٥٬٢٥٥px** (الأخبار) | **١٢٬٢٨١px** (البيانات المفتوحة) |
| صفحات فوق ١٤٬٠٠٠px | ٣ | **صفر** |
| فيضان أفقي | `open-data` | **صفر** |
| بوّابات لا تعرض شيئًا | **٣** | **صفر** |

### ١. ثلاث بوّابات كانت تعمل وتُجيب ولا تعرض شيئًا

`broadcasts` و`filings` و`venues`: الطلب يخرج، الخادم يردّ `200` ببيانات
حقيقية، والصفحة تبقى **٩٨٦ بكسل**. وصفتُها في مسحتين بأنها «غير مقيسة»
وافترضتُ خللًا في الأداة — **كانت تعمل في كل مرة.** صفحة لا تعرض شيئًا وصفحة
لم تُشغَّل هما نفس الـ٩٨٦ بكسل، وهذا هو الدرس.

ثلاثة أعطال: لا فرع عرض لها في الاتحاد؛ والموضوع المكتوب يُرسَل تحت اسم لا
يقرأه المسار فيُبتلع ويُردّ بالافتراضي العالمي (**جواب خاطئ يُقدَّم كصحيح**)؛
و«press Load» التي تَعِد بها العبارة نفسها مرفوضة.

**ولماذا لم يمسكه شيء:** `setResult({ kind, data } as Result)` — هذا التحويل
هو بالضبط تأكيد أن نوعًا خارج الاتحاد لا بأس به. TypeScript كان يملك الحقيقة
وقيل له تجاهلها. الحارس الآن يقرأ الشفرة: كل بوّابة في اللائحة إمّا تشارك عرض
اللوحات أو تسمّي نفسها في فرع، ومفتاح الجسم الذي ترسله هو مفتاح **يقرأه مسارها
هي** — مشتقًّا من ملفات المسارات لا من قائمة تُحدَّث يدويًّا.

٩٨٦ → ٢٥٣١ · ٣٢٥٥ · ٢١٨٩.

### ٢. أول ما أظهرته الصفحة العاملة كان رقمًا خاطئًا

بوّابة البثّ توجد لتجيب: **كم لغة متمايزة يبثّ بها مكانٌ الآن.** السعودية
أعادت **سبعًا**: `ar · arabi · arabic · العربية · english · filipino · kurdish`.
أربع منها عربية. الرقم الرئيسي أعلى بـ**٧٥٪** في العدد الوحيد الذي وُجدت
البوّابة لأجله.

انضباط §2a درجةً أدنى: هناك «الناشرون ليسوا تكاملات»، وهنا **«الهجاء ليس
لغة»**. `lib/engine/languages.ts` يحلّ رموز ISO 639-1 والأسماء الذاتية والنِّسَب
والاختصارات الوحيدة، **ولا يُسقط ما يعجز عن تعريفه** — فالعدّ قد يزيد بهجاء
ولا ينقص بلغة. السعودية الآن **أربع**.

والجزء الخطر مختبَر: `arabi` تُطوى إلى Arabic، و**`romani` يجب ألّا تُطوى إلى
`romanian`** — دمج هجاء هو الهدف، ومحو لغة نقيضه. الاختبار فشل أول مرة.

### ٣. بوّابة المرجع: شخصٌ ليس شركة، و429 ليست «لا نتائج»

**ماري كوري** تُحلّ إلى Q7186 بنداء واحد، والبوّابة أعادت صفحة فارغة
والأنطولوجيا سجّلت `company:Marie Curie`.

- **أسئلة شركات فقط** — الخصائص الخمس كلها مؤسسية، فشخصٌ يُحلّ تمامًا ثم لا
  يملك أيًّا منها. أُضيفت عشر خصائص، كلٌّ منها **محور انتقال** لا تفصيلًا
  سِيَريًّا.
- **نوع مؤكَّد لم يُقرأ قط** — `{ type: 'company' }` مثبَّتة في الشفرة. البوّابة
  التي وُجدت لتصنيف الكيانات كانت مصدر التصنيف الخاطئ. الآن `P31` يقرّر،
  و`other` هو الاحتياط: **ألّا تعرف خيرٌ من أن تؤكّد الخطأ**.
- **رفضٌ يُعرض كغياب** — أربعة `return []`. وبمجرّد `expectJson` ظهر السبب:
  `wikidata: provider answered 429`. ويكي‑داتا كانت تخنقنا، وجواب المنتج
  صفحة فارغة تُبلّغ أنها سليمة.

بعد الإصلاح: **٤١ حقيقة · النوع `person` · `sourcesFailed: 0`**، و
Alphabet Inc **١٦ حقيقة · النوع `company`**.

### ٤. المفتاح الأمني الذي ظهر أثناء الطريق

بريد المالك الشخصي كان مكتوبًا **أربع مرات** في `feeds/markets.ts` كعنوان
التواصل المعلَن لـSEC — أي في كل نسخة وتفريعة ومعاينة نشر. نجا لأنه **كان
يعمل**. الآن `USER_AGENT` الذي يقرأ `ENGINE_CONTACT` من البيئة، وحارس يمنع أي
صندوق بريد استهلاكي في `lib/engine` أو `scripts` — **بالشكل لا بالعنوان بعينه**.

### ٥. هوية واحدة للمحرّك، وإعادة فحص الحجر الصحّي

ثلاثة عشر مسار طلب كانت تحمل **أربع هويّات**، إحداها الصيغة التي يوثّق
المستودع أن SEC ترفضها بـ403. توحّدت كلها، ومعها سكربت تدقيق التغذيات الذي
كان يدّعي في توثيقه أنه يرسل «ترويسات المحرّك حرفًا بحرف» وهو يحمل نسخة يدوية.

وإعادة فحص الحجر: **ثمانٍ أجابت 200، أُطلقت ستّ ورُفضت اثنتان**. المرفوضتان
هما الدرس: `thedailystar_bd` تجيب 200 بعشرة عناصر أحدثها **صامت ١٤٩٢ يومًا**.
الإطلاق برمز الحالة كان سيعيد تقارير عمرها أربع سنوات إلى لوحة حيّة. الحجر
٥١ → ٤٣، والمصادر النشطة ١٦٤.

### ما تعلّمته عن أدواتي أنا

`git checkout --` على ملف فيه عمل غير مثبَّت محا ثلاث بوّابات كاملة؛ وفحص
جاهزية الخادم عندي كان يطبع «server up» دون شرط فأخذتُ قياسات ضدّ خادم غير
قائم. كل رقم في هذا القسم من عملية تحقّقتُ فيها من `http=200` أولًا.

---

## R189 — «البوّابات يجب أن تتطوّر تلقائيًّا»

نُفِّذ في ٢٠٢٦‑٠٨‑٢٢. القياس أولًا، كالعادة: `staleness.ts` و`/api/diagnose`
يراقبان صحّة المصادر التي *يستعملها* المنتج. **ولا شيء كان يعيد سؤال المصادر
التي استسلمنا لها.** ملفّ الحجر الصحّي نفسه يقول إن «إعادة تشغيل الفحص هي
كيف يُطلَق مصدر» — وكانت إعادة التشغيل شيئًا يتذكّره إنسان. تذكّرها أحدهم بعد
ثمانية أيام فعادت ستّ مصادر من إحدى وخمسين. تغطيةٌ لا تُشفى إلا حين يتذكّر
إنسان هي تغطية تتآكل.

الآن `/api/cron/sources` يوميًّا. و**رمز الحالة ليس إطلاقًا**: يجب أن تُقرأ
الوثيقة — تُحلَّل، وتحوي عناصر، وأحدثها داخل ٦٠ يومًا. تشغيلٌ حقيقي على
الشبكة الآن: فُحصت ٤٣ كلها، ولا إطلاق اليوم، والفخّان المعروفان أُمسكا
بالاسم (`thedailystar_bd` أحدث عنصر عمره ١٤٩١ يومًا، و`saws_south_africa`
صفر عناصر).

**ثلاثة أعطال ظهرت أثناء التوصيل، أُصلح كلٌّ في مكانه:**

1. **الحارس لم يكن يمرّر إشارة إلغاء أبدًا.** مهلة المنسّق `Promise.race`
   تُنهي *وعدنا* ولا تفعل شيئًا للطلب: المقبس يبقى مفتوحًا حتى سقف undici —
   خمس دقائق. والمسارات التي بلا منسّق هي بالضبط التي تعمل بلا رقيب (المهامّ
   المجدولة)، فمضيفٌ صامت واحد كان يكفي لابتلاع تشغيلة كاملة.
2. **`dueJobs` كان يعدّ النبضات داخل الساعة**، فسقفُ كل إيقاع ستون دقيقة:
   طلبُ ١٤٤٠ دقيقة كان يطابق عند الدقيقة صفر من **كل ساعة** — مهمّة يوميّة
   تعمل أربعًا وعشرين مرّة يوميًّا والرقم بجوارها يقول «مرّة». الجدول يكذب
   على نفسه، وهو صنف العطل الذي وُجد هذا الملفّ لإنهائه.
3. **ميزانيةٌ تبدأ دائمًا من الفهرس صفر** ليست فحصًا دوّارًا بل سؤالٌ لنفس
   رأس القائمة كل يوم، وذيلها لا يُسأل أبدًا. صار الترتيب يدور برقم اليوم:
   بلا مؤشّر مخزَّن، وما لا تبلغه ميزانية اليوم يتصدّر تشغيلة الغد.

قرار الحذف من سجلّ الحجر بقي بشريًّا: الرفع من سجلّ ما *رصدناه* يجب أن يكون
قرارًا لا أثرًا جانبيًّا.

---

## R268 — «تأكّد: أخطاء في قاعدة البيانات والإعدادات وقيتهيب ورسائل البريد»

نصّ الطلب: «وفيي عملك تاكد هناك اخطاء مختلفة في قاعدة البيانات والاعدادات
وقيتهيب ورسائل ايميل عن اخطاء وتكلم دئما بالعربي».

فُحصت الأربعة يوم ٢٠٢٦‑٠٨‑٢٧. النتيجة: **الأخطاء حقيقية، وواحدٌ منها فقط
كان في الشيفرة. البقيّة إعدادات نشرٍ لا يملكها أحد غير المالك.**

### ١. قيتهيب — ثغرة حقيقية، وأُصلحت

ثلاث تشغيلات Dependabot فاشلة (١٣–١٤ أغسطس) كلّها عن `nanoid`، ومعها بريدٌ
من قيتهيب عن كلّ فشل — وهذا على الأرجح مصدر «رسائل الإيميل عن الأخطاء».

السبب بالضبط: **GHSA‑2v37‑7h3g‑55p8**، خطورة **عالية**، تصيب كلّ إصدار أقلّ
من `3.3.18` (كنّا على `3.3.17`). و`nanoid` لا تصلنا مباشرةً بل عبر `postcss`،
ومداها `^3.3.17` يقبل النسخ المصابة — فلم يستطع Dependabot رفعها وفشل ثلاث
مرّات وهو يحاول.

الإصلاح بنفس آلية `overrides` المستعملة أصلًا: `"nanoid": "^3.3.18"`.
**`npm audit` قبل: ثغرة عالية واحدة. بعد: صفر.**

### ٢. قاعدة البيانات — ليست معطوبة، بل **غير موصولة أصلًا**

`DATABASE_URL` **غير مضبوط على أيٍّ من مواقع النشر الثلاثة**. فليست هناك
«أخطاء قاعدة بيانات» بالمعنى الدقيق: لا اتّصال إطلاقًا. وكلّ ما يعتمد على
الحفظ معطَّل — الحسابات، السجلّ، المراقِبات، الأنطولوجيا، التدقيق الذاتي.
(`/api/self-audit` مصمَّم أصلًا ليرمي خطأً بدل ادّعاء تدقيقٍ نظيف لم يجرِ.)

### ٣. الإعدادات — الخلل الأكبر

`/api/health` على المواقع الثلاثة يقول **`unhealthy`**، وينقصها:

| المتغيّر | الأثر المقيس |
|---|---|
| `SESSION_SECRET` | **تسجيل الدخول غير متاح كلّيًّا** (مطلوب) |
| `DATABASE_URL` | لا حفظ ولا حسابات ولا سجلّ |
| `CRON_SECRET` | `/api/cron/*` يردّ 503 — **لا نشر تلقائي، ووظيفة `sources` التي شُحنت قبل خمسة أيام لم تعمل ولا مرّة** |
| `ADMIN_SECRET` | مسارات الإدارة 503 |
| `SOCIAL_SECRET_KEY` | قنوات النشر لا تُحفظ |
| `MAIL_FROM` + مزوّد | التحقّق واستعادة كلمة السرّ تردّ 503 |

وثلاثة مشاريع Netlify تنشر المستودع نفسه، وأحدها (`voluble‑rabanadas`)
**متجمّد على بناء ١٥ أغسطس — اثنا عشر يومًا خلف `main`** وينقصه `PI_API_KEY`
الموجود في الآخرَين. ملفّا تحقّق Pi يُخدَمان بـ200 على الثلاثة.

**لم أضع أيّ مفتاح في أيّ ملفّ، ولن أفعل (S2).** هذه تُضبط في لوحة المضيف
وحدها. القائمة الكاملة والخطوات في `docs/DEPLOY.md`.

### ٤. البريد — لا أستطيع قراءته

موصّل Gmail في هذه الجلسة **غير مُصرَّح له**، والجلسة غير تفاعلية فلا يمكنني
إتمام التصريح. التصريح من إعدادات الموصّلات في claude.ai. لكن مصدر الرسائل
شبه مؤكَّد: إخطارات Dependabot عن الفشل الثلاثي أعلاه — وقد زال سببها.

### R268 — تتمّة: جعل الفحص قابلًا للتكرار

كلّ ما وجدتُه أعلاه كان **موجودًا أصلًا في `/api/health`**. لم ينتبه له أحد
لأنّ قراءته كانت شيئًا يتذكّره إنسان — وهو بعينه شكل العطل الذي أصلحه هذا
المستودع ثلاث مرّات في مواضع أخرى (الحجر الصحّي الذي لا يُشفى إلا بالتذكّر،
والمهمّة المجدولة على لا مضيف، والبثّ الذي لم يُتحقّق منه على المضيف).

فأضفتُ `npm run check:deploys`: يسأل كلّ مواقع النشر، يرتّب النتائج الأسوأ
أولًا، ويخرج بحالة غير صفرية إن كان شيءٌ **مانعًا أو متجمّدًا أو غير مُجيب**.
الحكم منفصل عن الجلب ومُختبَر بـ١٢ اختبارًا من قراءات اليوم الحقيقية،
والسكربت لا يُمنح أيّ مفتاح ولا يمرّر أيّ مفتاح — `/api/health` يقول إن كان
الإعداد مضبوطًا لا قيمته — فمخرجاته آمنة للّصق في أيّ مكان.

وقائمة مواقع النشر صارت **مكتوبةً في المستودع** (`lib/ops/deployments.ts`)،
لأنّ اكتشافها آليًّا يحتاج رمز وصولٍ للمضيف — وهو آخر ما يُوضع قرب مستودع.
والأهمّ: قائمةٌ يراها الناس هي قائمةٌ يُلاحَظ فيها أنّ ثلاثة مشاريع تبني
المستودع نفسه وأحدها متجمّد. هذا بقي خفيًّا ما دام في لوحة تحكّم فقط.

### R269 — «اعمل أنت كل ما تقدر عليه، وأعطني الممنوع عليك»

كلّ ما تبقّى من R268 هو ضبط متغيّرات في لوحة المضيف، ولا سبيل لي إليه:
موصّلا Netlify وSupabase يطلبان موافقة تفاعلية والجلسة غير تفاعلية، ولا
أملك — ولا يجب أن أملك — رمز وصولٍ للوحة. وتوليد القيم نفسها وإرسالها في
محادثة يناقض ما حذّرتُ منه بالضبط: مفتاحٌ مرّ في محادثة صار مفتاحًا محروقًا.

فما فعلتُه بدلًا من ذلك: **أزلتُ كلّ عقبة تسبق تلك النقرات وكلّ عقبة تليها.**

`npm run verify:live` — يجيب سؤالًا مختلفًا عن `check:deploys`: ذاك يقول
«هل الإعداد مضبوط»، وهذا يقول «هل يعمل فعلًا». والفرق بينهما هو حيث يجلس
نشرٌ يبدو سليمًا ولا يفعل شيئًا: مفتاح `CRON_SECRET` مضبوطٌ لكنّه مكتوبٌ
خطأً يردّ 403 إلى الأبد بينما كلّ تقرير إعدادات يقول إنّ الفحص يمرّ.

**خطأ ارتكبتُه وأصلحتُه في نفس الجلسة:** كتبتُ حكم قاعدة البيانات على شكل
استجابةٍ **اخترعتُه** (`{ok, detail}`) بدل أن أقرأ الشكل الحقيقي. فكانت
النتيجة أنّ نشرًا بلا `DATABASE_URL` أصلًا يُقال له «غير قابل للوصول — جرّب
مضيف الـPooler»، أي إرسال القارئ ليُصلح اتّصالًا لم يُحاوَل قطّ. قِستُ
الاستجابة الحقيقية فظهرت أربع حالات لا اثنتان — والحالة التي كانت ستفوتني
كلّها هي **قاعدةٌ قابلة للوصول وجداولها ناقصة**: شكلُ لصقٍ مبتور للمخطّط،
وأسهلُ ما يُظنّ أنه يعمل.

---

## R270–R273 — أربعة طلبات، ٢٠٢٦‑٠٨‑٢٧

نصّ الطلب: «وايضا تاكد من الترجمة جوجل لا تعمل كما قلت لك اضف كل اللغات وايضا
سرعة فتح التطبيق وايضا التسجيل التلقائي بمعرف الباي الحقيقي يكون تلقائي اذا
فتح عن طريق براوزر الباي نوتورك وايضا الاشتراك اجعله مخفي الان سنعدله لاحقا».

- **R270** — الترجمة عبر جوجل لا تعمل، وكلّ اللغات مطلوبة.
- **R271** — سرعة فتح التطبيق.
- **R272** — الدخول بمعرّف Pi الحقيقي **تلقائيًّا** عند الفتح من متصفّح Pi.
- **R273** — إخفاء الاشتراك مؤقّتًا (يُعدَّل لاحقًا، لا يُحذف).

### R270 — الترجمة: أُنجز

**السبب الحقيقي مقيسًا:** طرف جوجل الكيليّ يردّ **429 «Sorry…»** على كلّ طلب —
لأنه يرفض عناوين مراكز البيانات، وهو ما تملكه كلّ دالّة عديمة خادم. والشيفرة
كانت تبتلع الرفض (`if (!res.ok) return texts`)، فأجاب الموقع الحيّ:

```json
{"translations":["Live world events"],"stats":{"fetched":2}}   HTTP 200
```

**ادّعاء نجاحٍ فوق نصٍّ لم يُترجَم.** ولهذا لم يره أحد: لا المنتج ولا
الاختبارات ولا فحوص الصحّة.

وعطلٌ ثانٍ أخطر: عند الرفض كان **النصّ الإنجليزي يُخزَّن في الذاكرة المؤقّتة
تحت مفتاح عربي** — فيبقى لعمر النسخة حتى بعد تعافي المزوّد، ولا شيء يُبطله.

**واستنتاجي الأول كان خاطئًا، وصحّحه المالك.** قلتُ إنّ الكيليّة مستحيلة من
الخادم بعد أن جرّبتُ MyMemory وثلاث نسخ Lingva وLibreTranslate — وعمّمتُ من
طرفٍ واحدٍ اختبرتُه. الحقيقة أدقّ: **المضيف والعميل هما ما يُرفض، لا غياب
المفتاح.**

| الطرف | النتيجة |
|---|---|
| `translate.googleapis.com` · `client=gtx` | **429** دائمًا |
| `clients5.google.com` · `client=dict-chrome-ex` | **200** — يعمل |
| `translate.google.com` · `client=at` | 200 لكن يعيد ترجمةً واحدة لثلاثة مدخلات |

قياس `clients5`: دفعة **٤٠/٤٠**، وثماني لغات متنوّعة (سواحيلية، تاميلية،
يوروبا، أردية) كلّها 200، و**١٠ نداءات متتابعة ١٠/١٠**. فصار هو **أوّل**
السلسلة: بلا مفتاح وبلا حساب وبلا بطاقة.

**ما بُني:**
1. المزوّد يرمي عند الفشل ولا يعيد الأصل بصمت.
2. سلسلة مزوّدين: **DeepL** و**Google Cloud** (بمفتاح) ثم الكيليّ أخيرًا.
3. الطريق لا يخزّن إلا ترجمةً حقيقية، ويقول `translated` لا `fetched`.
4. الواجهة **تُخبر القارئ** حين لا يترجم أحد — بدل أن يستنتج أنّ لا عربية.
5. المنتقي: **١٠٨ لغة** بدل ٧، ببحثٍ يطابق الاسم بلغته أو رمزه.

### R270 — تصحيح: لا مفتاح مطلوب

طلب المالك استبدال الاعتماد على `GOOGLE_TRANSLATE_API_KEY` بمسارٍ مجّاني بلا
مفاتيح ولا بطاقات. وكان محقًّا، وكنتُ مخطئًا: قِستُ طرفًا واحدًا وعمّمتُ منه.

`clients5.google.com` مع `client=dict-chrome-ex` صار **أوّل** السلسلة، ومعه
تُترجم اللغات الـ١٠٨ بلا أيّ اعتماد. المفاتيح صارت **إضافةً اختيارية** لا
شرطًا — ومتأخّرةً في الترتيب عمدًا، حتى لا ينفق نشرٌ يملك مفتاح DeepL حرفًا
واحدًا من حصّته على طلبٍ كان الطريق المجّاني ليخدمه.

وتُرك `client=at` عمدًا رغم أنه يجيب 200: أعطيتُه ثلاثة نصوص فأعاد واحدًا،
ومزوّدٌ يعيد أقلّ ممّا أُعطي يُزيح كلّ عنوانٍ في الصفحة بمقدار واحد.
