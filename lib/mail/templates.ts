/**
 * The two messages this product sends.
 *
 * ## Why the copy is written out per language
 *
 * The interface is translated at runtime, which is fine for a page a reader can
 * re-render. An email cannot be re-rendered: it is composed once, at send time,
 * on a server that may have no network path to a translation service and must
 * not fail to send a security code because one was unreachable. So the copy for
 * every locale the product supports is written here, in the repository, the same
 * way `lib/i18n/dictionaries.ts` writes the interface copy.
 *
 * ## What these messages deliberately do not contain
 *
 * No link. A code the reader types into the page they are already on cannot be
 * turned into a phishing click, and a one-click reset link in an email is the
 * single most abused pattern in account recovery. It costs the reader four
 * seconds of typing and removes an entire attack.
 *
 * No name, no account details, no history — the address may not belong to the
 * person who asked, because anyone can type anyone's address into a reset form.
 * The message must therefore be safe to receive by mistake.
 */
import type { Locale } from '@/lib/i18n/dictionaries'
import type { MailMessage } from './types'

export type CodePurpose = 'signup' | 'reset'

interface Copy {
  subject: string
  /** Opening line — says what was asked for, without asserting who asked. */
  lead: string
  codeLabel: string
  expiry: string
  /** What to do if this was not you. */
  disclaim: string
  signature: string
  dir: 'ltr' | 'rtl'
}

const COPY: Record<Locale, Record<CodePurpose, Copy>> = {
  en: {
    signup: {
      subject: 'Your Lambda verification code',
      lead: 'Someone entered this address to create a Lambda account. Enter this code on the sign-up page to confirm it is yours.',
      codeLabel: 'Verification code',
      expiry: 'The code expires in {minutes} minutes and can be used once.',
      disclaim: 'If you did not ask for this, ignore this message — no account was created and nothing further will be sent.',
      signature: 'Lambda — intelligence platform',
      dir: 'ltr',
    },
    reset: {
      subject: 'Your Lambda password reset code',
      lead: 'A password reset was requested for the Lambda account at this address. Enter this code on the reset page to set a new password.',
      codeLabel: 'Reset code',
      expiry: 'The code expires in {minutes} minutes and can be used once.',
      disclaim: 'If you did not ask for this, ignore this message — your password has not changed and nobody was told whether an account exists here.',
      signature: 'Lambda — intelligence platform',
      dir: 'ltr',
    },
  },
  ar: {
    signup: {
      subject: 'رمز التحقق الخاص بك في لامبدا',
      lead: 'أُدخل هذا العنوان لإنشاء حساب في لامبدا. أدخل هذا الرمز في صفحة التسجيل لتأكيد أن العنوان لك.',
      codeLabel: 'رمز التحقق',
      expiry: 'ينتهي الرمز خلال {minutes} دقيقة، ويُستخدم مرة واحدة فقط.',
      disclaim: 'إن لم تطلب هذا فتجاهل الرسالة — لم يُنشأ أي حساب ولن تصلك رسائل أخرى.',
      signature: 'لامبدا — منصة الاستخبارات',
      dir: 'rtl',
    },
    reset: {
      subject: 'رمز إعادة تعيين كلمة السر في لامبدا',
      lead: 'طُلبت إعادة تعيين كلمة السر للحساب المرتبط بهذا العنوان. أدخل هذا الرمز في صفحة الاستعادة لتعيين كلمة سر جديدة.',
      codeLabel: 'رمز الاستعادة',
      expiry: 'ينتهي الرمز خلال {minutes} دقيقة، ويُستخدم مرة واحدة فقط.',
      disclaim: 'إن لم تطلب هذا فتجاهل الرسالة — لم تتغير كلمة سرك، ولم نُخبر أحدًا بوجود حساب من عدمه.',
      signature: 'لامبدا — منصة الاستخبارات',
      dir: 'rtl',
    },
  },
  es: {
    signup: {
      subject: 'Tu código de verificación de Lambda',
      lead: 'Alguien introdujo esta dirección para crear una cuenta en Lambda. Escribe este código en la página de registro para confirmar que es tuya.',
      codeLabel: 'Código de verificación',
      expiry: 'El código caduca en {minutes} minutos y solo puede usarse una vez.',
      disclaim: 'Si no lo has pedido tú, ignora este mensaje: no se ha creado ninguna cuenta y no recibirás nada más.',
      signature: 'Lambda — plataforma de inteligencia',
      dir: 'ltr',
    },
    reset: {
      subject: 'Tu código para restablecer la contraseña de Lambda',
      lead: 'Se ha pedido restablecer la contraseña de la cuenta de Lambda asociada a esta dirección. Escribe este código en la página de recuperación para elegir una nueva.',
      codeLabel: 'Código de recuperación',
      expiry: 'El código caduca en {minutes} minutos y solo puede usarse una vez.',
      disclaim: 'Si no lo has pedido tú, ignora este mensaje: tu contraseña no ha cambiado y no se ha revelado a nadie si existe una cuenta aquí.',
      signature: 'Lambda — plataforma de inteligencia',
      dir: 'ltr',
    },
  },
  fr: {
    signup: {
      subject: 'Votre code de vérification Lambda',
      lead: 'Cette adresse a été saisie pour créer un compte Lambda. Saisissez ce code sur la page d’inscription pour confirmer qu’elle vous appartient.',
      codeLabel: 'Code de vérification',
      expiry: 'Le code expire dans {minutes} minutes et ne peut servir qu’une fois.',
      disclaim: 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : aucun compte n’a été créé et rien d’autre ne vous sera envoyé.',
      signature: 'Lambda — plateforme de renseignement',
      dir: 'ltr',
    },
    reset: {
      subject: 'Votre code de réinitialisation Lambda',
      lead: 'Une réinitialisation du mot de passe a été demandée pour le compte Lambda lié à cette adresse. Saisissez ce code sur la page de récupération pour en choisir un nouveau.',
      codeLabel: 'Code de récupération',
      expiry: 'Le code expire dans {minutes} minutes et ne peut servir qu’une fois.',
      disclaim: 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe est inchangé et personne n’a appris si un compte existe ici.',
      signature: 'Lambda — plateforme de renseignement',
      dir: 'ltr',
    },
  },
  zh: {
    signup: {
      subject: 'Lambda 验证码',
      lead: '有人使用此邮箱地址注册 Lambda 账户。请在注册页面输入以下验证码，确认该地址属于你。',
      codeLabel: '验证码',
      expiry: '验证码将在 {minutes} 分钟后失效，且仅可使用一次。',
      disclaim: '若非本人操作，请忽略本邮件——账户尚未创建，我们也不会再发送任何邮件。',
      signature: 'Lambda — 情报分析平台',
      dir: 'ltr',
    },
    reset: {
      subject: 'Lambda 密码重置码',
      lead: '有人为此邮箱地址对应的 Lambda 账户申请重置密码。请在重置页面输入以下代码，以设置新密码。',
      codeLabel: '重置码',
      expiry: '代码将在 {minutes} 分钟后失效，且仅可使用一次。',
      disclaim: '若非本人操作，请忽略本邮件——你的密码没有更改，我们也未向任何人透露此处是否存在账户。',
      signature: 'Lambda — 情报分析平台',
      dir: 'ltr',
    },
  },
  hi: {
    signup: {
      subject: 'आपका Lambda सत्यापन कोड',
      lead: 'किसी ने Lambda खाता बनाने के लिए यह पता दर्ज किया है। यह पता आपका है, इसकी पुष्टि के लिए साइन-अप पृष्ठ पर यह कोड दर्ज करें।',
      codeLabel: 'सत्यापन कोड',
      expiry: 'यह कोड {minutes} मिनट में समाप्त हो जाएगा और केवल एक बार उपयोग किया जा सकता है।',
      disclaim: 'यदि यह अनुरोध आपने नहीं किया, तो इस संदेश को अनदेखा करें — कोई खाता नहीं बना है और आगे कुछ नहीं भेजा जाएगा।',
      signature: 'Lambda — इंटेलिजेंस प्लेटफ़ॉर्म',
      dir: 'ltr',
    },
    reset: {
      subject: 'आपका Lambda पासवर्ड रीसेट कोड',
      lead: 'इस पते से जुड़े Lambda खाते के लिए पासवर्ड रीसेट का अनुरोध किया गया है। नया पासवर्ड चुनने के लिए रीसेट पृष्ठ पर यह कोड दर्ज करें।',
      codeLabel: 'रीसेट कोड',
      expiry: 'यह कोड {minutes} मिनट में समाप्त हो जाएगा और केवल एक बार उपयोग किया जा सकता है।',
      disclaim: 'यदि यह अनुरोध आपने नहीं किया, तो इस संदेश को अनदेखा करें — आपका पासवर्ड नहीं बदला है, और किसी को यह नहीं बताया गया कि यहाँ खाता है या नहीं।',
      signature: 'Lambda — इंटेलिजेंस प्लेटफ़ॉर्म',
      dir: 'ltr',
    },
  },
  id: {
    signup: {
      subject: 'Kode verifikasi Lambda Anda',
      lead: 'Ada yang memasukkan alamat ini untuk membuat akun Lambda. Masukkan kode berikut di halaman pendaftaran untuk memastikan alamat ini milik Anda.',
      codeLabel: 'Kode verifikasi',
      expiry: 'Kode ini kedaluwarsa dalam {minutes} menit dan hanya dapat dipakai sekali.',
      disclaim: 'Jika bukan Anda yang meminta, abaikan pesan ini — tidak ada akun yang dibuat dan tidak ada kiriman lain.',
      signature: 'Lambda — platform intelijen',
      dir: 'ltr',
    },
    reset: {
      subject: 'Kode atur ulang kata sandi Lambda',
      lead: 'Ada permintaan atur ulang kata sandi untuk akun Lambda pada alamat ini. Masukkan kode berikut di halaman pemulihan untuk menetapkan kata sandi baru.',
      codeLabel: 'Kode pemulihan',
      expiry: 'Kode ini kedaluwarsa dalam {minutes} menit dan hanya dapat dipakai sekali.',
      disclaim: 'Jika bukan Anda yang meminta, abaikan pesan ini — kata sandi Anda tidak berubah, dan tidak ada yang diberi tahu apakah akun di sini ada.',
      signature: 'Lambda — platform intelijen',
      dir: 'ltr',
    },
  },
}

/** Escape for HTML text content. The code is ours, the address is not. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Compose the message.
 *
 * The HTML is a table with inline styles and no external resource of any kind —
 * no web font, no tracking pixel, no linked stylesheet. Mail clients strip most
 * of what a browser would honour, and a message that fetches something from us
 * on open would tell us when a reader opened it, which is not information a
 * verification code needs to collect.
 */
export function codeEmail(input: {
  to: string
  code: string
  purpose: CodePurpose
  minutes: number
  locale?: string
}): MailMessage {
  const locale = (input.locale && locale2(input.locale)) || 'en'
  const copy = COPY[locale][input.purpose]
  const expiry = copy.expiry.replace('{minutes}', String(input.minutes))

  const text = [copy.lead, '', `${copy.codeLabel}: ${input.code}`, '', expiry, '', copy.disclaim, '', copy.signature].join(
    '\n',
  )

  const html = [
    `<div dir="${copy.dir}" style="margin:0;padding:24px;background:#0b0f14;color:#e6edf3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6">`,
    '<div style="max-width:520px;margin:0 auto;background:#111820;border:1px solid #1f2933;border-radius:12px;padding:28px">',
    '<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#4fc3f7">&#955; Lambda</div>',
    `<p style="margin:20px 0 0">${escapeHtml(copy.lead)}</p>`,
    `<p style="margin:22px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#8b98a5">${escapeHtml(copy.codeLabel)}</p>`,
    // dir="ltr" on the code itself: the digits must read the same way in an
    // Arabic message as in an English one, or the reader types them reversed.
    `<div dir="ltr" style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.28em;color:#ffffff;background:#0b0f14;border:1px solid #1f2933;border-radius:8px;padding:14px 18px;text-align:center">${escapeHtml(input.code)}</div>`,
    `<p style="margin:16px 0 0;font-size:13px;color:#8b98a5">${escapeHtml(expiry)}</p>`,
    `<p style="margin:16px 0 0;font-size:13px;color:#8b98a5">${escapeHtml(copy.disclaim)}</p>`,
    `<p style="margin:22px 0 0;font-size:12px;color:#5c6b7a">${escapeHtml(copy.signature)}</p>`,
    '</div></div>',
  ].join('')

  return { to: input.to, subject: copy.subject, text, html }
}

/** `ar-EG` and `AR` both mean the Arabic copy; anything unknown means English. */
function locale2(raw: string): Locale | null {
  const base = raw.trim().toLowerCase().split(/[-_]/)[0]
  return base in COPY ? (base as Locale) : null
}
