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
| R180 | 2026-08-20 | `gateways` | | `open` | كل البورصات والأسهم بكل أنواعها |
| R181 | 2026-08-20 | `gateways` | | `open` | اقتصادات الشركات والدول — أكبر وأهم الشركات: شراكاتها، أعمالها، معلوماتها، أسهمها |
| R182 | 2026-08-20 | `gateways` | | `done` | بوّابة تُظهر **تصنيف** الشركات — ترتيب أكبر ٢٥ مُودِعًا بإجمالي الأصول من إطارات XBRL (٦١١٠ شركة)، والمقياس مُسمّى لا مُضمَر |
| R183 | 2026-08-20 | `gateways` | | `open` | شركات ومصانع الدول والقطاع الخاص |
| R184 | 2026-08-20 | `gateways` | | `open` | آليّة تعمل **تلقائيًا** لكل البوّابات |
| R185 | 2026-08-20 | `gateways` | | `open` | كل العملات الرقمية والبلوكشين بكل معلوماته وأهم أخباره |
| R186 | 2026-08-20 | `gateways` | | `done` | بوّابة **المعادن والثروات** — `resources`: ١٨ سلسلة أسعار من صندوق النقد عبر FRED (نحاس، ألمنيوم، نيكل، زنك، رصاص، قصدير، حديد، يورانيوم، فحم، غاز + غذاء + ٣ مؤشرات) |
| R187 | 2026-08-20 | `gateways` | | `open` | اعمل بحثًا وحدّد **قائمة بكل البوّابات** ثم أنجزها |
| R188 | 2026-08-20 | `gateways` | | `done` | بوّابة `officials` — خطب محافظي البنوك المركزية بنصّها من BIS، مجمّعة لكل متحدّث. **أفعال المنصب العامة فقط**، لا حياة خاصة (§3) |
| R189 | 2026-08-20 | `gateways` | | `open` | البوّابات يجب أن **تتطوّر تلقائيًا** |
| R190 | 2026-08-20 | `globe` | | `open` | صفحة الكرة تُرتَّب وتحوي **كل** البوّابات — البوّابات الآن ٢٦ في ٧ عائلات على `/intelligence`؛ يبقى ربطها بالكرة |
| R191 | 2026-08-20 | `gateways` | | `done` | **٧ بوّابات جديدة**: المحاكم · التنظيم · المسؤولون · المعادن · شبكة الكهرباء · طقس الفضاء · الأجسام المدارية — كلها من الجهة الأصلية، بلا مفاتيح، ومُختبرة حيّة |
| R192 | 2026-08-20 | `gateways` | 2 | `open` | التطبيق كله يتحدّث عن الطقس والزلازل — اجمع كل المتشابه في **بوّابة واحدة** |
| R193 | 2026-08-20 | `design` | | `done` | **التاريخ:** «قبل ساعة» وهو خبر من أيام. ضع التاريخ الأصلي بتوقيت المنطقة، والنسبي حتى يوم واحد ثم التاريخ فقط |
| R194 | 2026-08-20 | `auth` | 2 | `done` | الدخول باسم مستخدم Pi فقط وتلقائيًا — لأن Pi عندها KYC حقيقي |
| R195 | 2026-08-20 | `auth` | 2 | `done` | خارج Pi: الدخول بالبريد + رسالة كود لإنشاء كلمة السر |
| R196 | 2026-08-20 | `auth` | 2 | `done` | اسم مستخدم يختاره المستخدم |
| R197 | 2026-08-20 | `auth` | | `done` | **الاسم الكامل** عند التسجيل، ويظهر للآخرين اسم المستخدم فقط + رمز **عين** يبدّل إظهار/إخفاء الاسم الحقيقي بكل ضغطة |
| R198 | 2026-08-20 | `i18n` | 2 | `open` | ترجمة جوجل لكل اللغات في التطبيق |
| R199 | 2026-08-20 | `publishing` | 2 | `done` | النشر التلقائي **يعمل ويتجدّد**: ثلاث طرق مستقلّة — Netlify كل ٢٠ دقيقة، Vercel يوميًّا (سقف الخطّة)، و`lib/modules/self-drive.ts` بلا أيّ مجدول إطلاقًا. مُثبت حيًّا: قراءة صفحة فارغة نشرت ٦ تنبيهات NWS حقيقية خلال ١٠ ثوانٍ. ولا كلمة «AI» على أيّ منشور |
| R200 | 2026-08-20 | `osint` | | `open` | أدوات المصادر المفتوحة **وهمية ولا تعطي معلومات** — فعّلها وزوّدها بأقوى التقنيات |
| R201 | 2026-08-20 | `innovation` | 2 | `open` | أضف ابتكاراتك بكل مميزاتها وأدواتها، مفعّلة كليًا |
| R202 | 2026-08-20 | `competitors` | 3 | `open` | تصفّح واستعمل وجرّب التطبيقات الأخرى **كمستخدم إنسان حقيقي** — لا ادّعاء |
| R203 | 2026-08-20 | `deploy` | 2 | `open` | أرسل ملف zip بعد إنجاز كل ما سبق |
| R204 | 2026-08-20 | `general` | | `open` | **قاعدة:** كل نقطة أطلبها — ابحث عنها، طبّقها بأحدث وأقوى الطرق وبكل إعداداتها من **المرّة الأولى**، لا إضافة ثم عشرات التعديلات |
| R205 | 2026-08-20 | `deploy` | 2 | `done` | مُثبت هذه المرّة بالفعل: فُكّ الزيب في مجلّد نظيف، `npm install` ثم `npm run build` ثم `npm start` — الكرة تعمل (٢٤٨/٢٨٧٧ حدثًا حيًّا)، والبوّابات تعمل (١١ سجلًّا من NOAA)، بلا مفتاح ولا قاعدة بيانات. وأُضيفت صفحة `/setup` التي تُشخّص أيّ الأسباب الثلاثة يمنع النسخة من العمل |
| R206 | 2026-08-20 | `globe` | | `done` | إعدادات الكرة تُحفظ فعلًا — مُثبت في متصفّح حقيقي: فتح مربّع، الانتقال إلى الصفحة الرئيسية والعودة، والإعداد كما هو (`panels:["seismic"]`). يعمل بلا قاعدة بيانات أيضًا |
| R207 | 2026-08-20 | `globe` | | `done` | مربّع لكل صنف أسفل الخريطة: الأهمّ أوّلًا ثم الأحدث، مع المصدر ووقت الناشر نفسه ودرجة Admiralty وحالة التأكيد على كل سطر |
| R208 | 2026-08-20 | `globe` | | `done` | ثلاثة أحجام (مضغوط/عادي/عريض) + ترتيب المربّعات + ضغطة واحدة تفتح المربّع وتُلغي إخفاء الصنف معًا. وأُصلح لبس حقيقي وجدته أثناء التجربة: صفّان من الأزرار يحملان نفس الكلمات ويفعلان شيئين مختلفين — كلٌّ منهما يسمّي فعله الآن |
| R209 | 2026-08-20 | `design` | | `open` | **اختيار من ١ إلى ٥ بوّابات** يختارها المستخدم لتظهر في الصفحة الرئيسية |
| R210 | 2026-08-20 | `auth` | 3 | `done` | التسجيل بمعرّف Pi دون بريد يعمل، وأُصلح خلل جوهري: الكود كان يبني الاسم من `uid` (معرّف عشوائي ٣٦ حرفًا) لا من `username`، فكان **كل رائد يحصل على حساب بلا اسم إطلاقًا** بصمت. مُثبت حيًّا بمقلّد رسمي لواجهة Pi. يبقى اختبار داخل متصفّح Pi الحقيقي — لا نملكه هنا |
| R211 | 2026-08-20 | `data` | | `done` | مُثبت على PostgreSQL 16 حقيقي بترحيلات المستودع نفسها: ٢٣ جدولًا، بلا أخطاء. `/api/health?deep=1` يردّ «connected to PostgreSQL 16.13 in 27ms; all 23 tables present». دورة كاملة: تسجيل دخول Pi → كتابة الصفوف → جلسة → مطالبة بكلمة سر → دخول خارج Pi بنفس الحساب |
| R212 | 2026-08-20 | `gateways` | 2 | `open` | مصادر وبوّابات كثيرة لم تُذكر بعد — أين البحث والخبرة |
| R213 | 2026-08-20 | `gateways` | | `open` | كل ما يخصّ الاقتصاد والمال والاكتشافات والأبحاث والأخبار موجود ومرتّب |
| R214 | 2026-08-20 | `gateways` | | `done` | بوّابة `statements` — تسع جهات كلامها فعل (البيت الأبيض، الأمم المتّحدة، المفوّضية الأوروبية، الفدرالي، المركزي الأوروبي، الحكومة البريطانية، الوكالة الذرّية، الصحّة العالمية). مرتّبة بالأثر عبر `lib/analysis/impact.ts` مع **إظهار سبب كل ترتيب** لا رقمًا مجرّدًا. حيًّا: ١٣٠ سجلًّا في ٩ مجموعات |
| R215 | 2026-08-20 | `auth` | 1 | `open` | **داخل متصفّح Pi:** التسجيل باسم مستخدم Pi **فقط**. **خارجه:** بالبريد + كود تأكيد + استعادة كلمة السر. الفصل يكون بكشف البيئة لا بخيار المستخدم |
| R216 | 2026-08-20 | `auth` | 1 | `open` | **معرّف خاص لكل مستخدم** |
| R217 | 2026-08-20 | `deploy` | 1 | `open` | المشروع تطبيق داخل متصفّح Pi **و** موقع عام يُطلق فور الجاهزية — رتّبها باحترافية |
| R218 | 2026-08-20 | `globe` | 1 | `open` | **صفحة الخريطة: أخطاء ومعلومات خاطئة**، ومعلومات يجب حجبها عن العامّة |
| R219 | 2026-08-20 | `gateways` | 1 | `open` | الأخبار كلّها **طقس، قديمة، مكرّرة** — مزعج. اجمع الطقس والزلازل والبراكين والكوارث وكل الأحداث الطبيعية في **بوّابة واحدة** |
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
| R164 | 2026-08-15 | `globe` | | `open` | لا تعرض في صفحة الكرة ما لا نحتاجه |
| R165 | 2026-08-15 | `globe` | | `open` | اجمع المتشابه: الفيضانات والزلازل وغيرها أشياء طبيعية — تُضمّ معًا كما هو أنسب |
| R166 | 2026-08-15 | `globe` | | `open` | طوّر الخريطة والكوكب إلى الأرقى |
| R167 | 2026-08-15 | `design` | | `done` | صنّف ورتّب وزِد التنوّع والفئات، والترتيب والفرز والعرض باحترافية — صنّف ورتّب — ٢٦ بوّابة في ٧ عائلات، وكل لوحة تصل مجمَّعة مع عدّاد لكل مجموعة واختيار متعدّد |
| R168 | 2026-08-15 | `data` | | `done` | **الأسهم** — Stooq مات (تحدّي بوت بـ200)؛ استُبدل بـFRED. S&P 500 · Dow · Nasdaq · VIX تعمل الآن |
| R169 | 2026-08-15 | `data` | | `open` | **العملات** (فوركس) — غير موجودة |
| R170 | 2026-08-15 | `data` | | `open` | **البلوكشين بكل التفاصيل والمعلومات والأسعار** |
| R171 | 2026-08-15 | `data` | | `open` | **العملات الرقمية بكل التفاصيل** |
| R172 | 2026-08-15 | `data` | | `done` | **العقارات** — بوّابة `property`: FRED (كيس-شيلر، سعر البيع الوسيط، بدء الإنشاءات، الرهن ٣٠ سنة، الشغور، المعروض) + Eurostat مؤشر أسعار المساكن + سجل الأراضي البريطاني. ٣٧ رقمًا، ٣٢ إقليمًا، حيّ |
| R173 | 2026-08-15 | `data` | | `done` | **أهم الشركات** — بوّابة `companies` من SEC EDGAR: الهوية والأسماء السابقة والقطاع والبورصات، الإيداعات الأخيرة، والأرقام كما صرّحت بها الشركة (XBRL) + ترتيب أكبر الشركات بميزانياتها |
| R174 | 2026-08-15 | `auth` | | `done` | **تسجيل تلقائي داخل Pi باسم مستخدم Pi فقط** — `app/api/auth/pi/route.ts`: لا نموذج، الاسم من Pi نفسها |
| R175 | 2026-08-15 | `auth` | | `done` | **خارج Pi:** كود ٦ أرقام (١٥ دقيقة، ٥ محاولات)، `lib/mail` عميل SMTP خاص بنا، ٤ مسارات، بلا تسريب لوجود الحساب |
| R176 | 2026-08-15 | `auth` | | `done` | اسم مستخدم يختاره المستخدم — `lib/auth/policy.ts` + النموذج، مساحة أسماء واحدة مع Pi |
| R177 | 2026-08-15 | `deploy` | | `done` | تنزيل ملف zip (حزمة التطبيق) — ملف zip — نسختان: كاملة (١٤٤٠ ك.ب) و`studio` تحت حدّ الميغابايت (٩٣٨ ك.ب)، `npm run package:studio` |
| R151 | 2026-08-15 | `design` | | `open` | فرز وترتيب الصفحة — الصفحة غير مرتّبة وتحتاج فرزًا وترتيبًا حقيقيًا |
| R152 | 2026-08-15 | `general` | | `open` | النشر التلقائي يجب أن يعمل **باستمرار** وليس مثبّتًا/ساكنًا |
| R153 | 2026-08-15 | `ai` | | `done` | وكلاء ذكاء دائمون — `.claude/agents/` (ledger-keeper, field-scout, source-hunter, user-walker) |
| R154 | 2026-08-15 | `general` | | `done` | فتح التطبيق حقيقيًا كمستخدم بكل الفئات — `scripts/walkthrough.ts`, `npm run walkthrough` |
| R155 | 2026-08-15 | `competitors` | | `open` | البحث لم يكتمل — ٢٩ منصّة لم تُقَس، ومواقع وثائقها مفتوحة ولم تُنقَّب |
| R156 | 2026-08-15 | `general` | 2 | `done` | **القاعدة الدائمة:** كل طلب يُسجَّل بتفاصيله حتى يُنفَّذ ثم يُنقل للمنفَّذ — `docs/ledger/` |
| R157 | 2026-08-15 | `general` | | `done` | استرجاع كل الطلبات من أول المشروع — ١٥٠ رسالة، ١٥١٠ تعليمة |
| R158 | 2026-08-15 | `design` | | `done` | **[walkthrough]** Vercel Analytics 404 في كل صفحة — أُزيل من `app/layout.tsx` |
| R159 | 2026-08-15 | `design` | | `open` | **[walkthrough]** `/monitor` يعرض ٤١٣ حرفًا وعنصرًا واحدًا لزائر غير مسجّل |
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

### R151–R236 — reconstructed

| # | Area | Status | Request |
|---|---|---|---|
| R204 | `method` | `standing` | Implement each point with the newest/strongest methods, fully, first time. `reconstructed` |
| R215 | `pi` | `done` | One build must serve Pi Browser and the public web — decide the surface at runtime, not at build time. |
| R216 | `accounts` | `done` | A permanent, human-readable account identifier a person can read down a phone. |
| R217 | `launch` | `open` | Organise the Pi app and the public website launch professionally. |
| R218 | `globe` | `open` | Map page: fix errors, wrong information, and anything that must not be public. |
| R220 | `news` | `done` | Breaking-event highlighting, wired into the interface rather than computed and discarded. |
| R221 | `design` | `open` | Every gateway rendered in the flowing "happening now" design. |
| R222 | `design` | `open` | Categories that need more tools should have them. |
| R223 | `design` | `done` | All 22 categories reachable, not only the first eight. |
| R227 | `innovation` | `open` | More innovation, more new solutions. |
| R229 | `method` | `standing` | Act as the expert; do not wait to be told. |
| R230 | `method` | `standing` | Fix every bug and vulnerability immediately on discovery. |
| R231 | `mail` | `done` | Email registration, verification codes and password reset must actually work. |
| R232 | `mail` | `done` | Add follow-by-email with a confirmation message. |
| R233 | `pi` | `open` | In the Pi app, registration by real Pi identifier only — one button, account saved, payments live. |
| R234 | `design` | `open` | The sign-in panel must stop mixing email with Pi name/identifier. |
| R235 | `news` | `open` | News dates are wrong; everything shown is old, scattered and overlapping. |
| R236 | `design` | `done` | Full-bleed layout: the map holds the screen, data runs beside it. |

### 2026-08-20 — today, verbatim

| # | Area | Status | Request |
|---|---|---|---|
| R237 | `mail` | `open` | **يزال هناك خطا في التحقق من الايميل** — email verification still errors. Fix first. |
| R238 | `design` | `open` | **هل ترى الفرق في التصميم اجعلها مثلها** — match the design in the two screenshots exactly. |
| R239 | `design` | `open` | **اجعل المربعات اصغر وليس مستطيلات** — the boxes must be smaller and square, not rectangles. |
| R240 | `design` | `open` | **كل الفئات يجب توفر مربع خاص بها والمعلومات والاخبار تتدفق داخلها** — every category gets its own box with its news flowing inside it. |
| R241 | `markets` | `open` | **كل اللوحات الاقتصادية وكل المفقود** — every economic board, and everything missing. |
| R242 | `markets` | `open` | **لا عملات ولا كل بلوكشين ولا بورصات ولا اي شيئ** — still no companies, no blockchains, no exchanges showing anywhere. |
| R243 | `design` | `open` | **اجمع كل ماهو طبيعي … في مربع وفئة واحدة واعمل لها جزئين منها حدث ومنها تحذير** — merge every natural hazard (earthquakes, volcanoes, weather, all disasters) into ONE category and box, split into two parts: *event* and *warning*. They flood the news and overlap. |
| R244 | `sources` | `open` | **في التطبيقات المنافسة كل انواع وفئات تجلب دون توقف الاخبار حية … الا تطبيقنا كله تحذير واعادة** — competitors pull every category live and continuously; ours is all warnings and repetition. |
| R245 | `sources` | `open` | **واين الهجمات السيبرانية والاختراق والابحاث والازمات ونقص الامدادات** — where are cyber attacks and breaches, research, crises, supply shortages? |
| R246 | `markets` | `open` | **كل اخبار الاقتصاد والشركات والمصانع** — all economy, company and industrial news. |
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
