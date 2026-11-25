interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const MOUSE_TOUCH_ITEMS = [
  { trigger: 'کشیدن روی نقشه', desc: 'حمله یا پشتیبانی مستقیم بین قلعه‌های هم‌مرز (ماوس و لمس)' },
  { trigger: 'Shift + کلیک روی همسایه خودی', desc: 'ایجاد یا لغو خط تأمین خودکار (ارسال مداوم نیرو به خط مقدم)' },
  { trigger: 'دابل‌کلیک روی قلعه خود', desc: 'فراخوانی ۵۰٪ نیروی کمکی از تمام قلعه‌های هم‌مرز خودی' },
  { trigger: 'کلیک راست روی همسایه', desc: 'اعزام فوری ۱۰۰٪ نیروی قابل ارسال قلعه انتخابی' },
  { trigger: 'اسکرول ماوس روی نقشه', desc: 'تغییر سریع درصد اعزام (۲۵٪ / ۵۰٪ / ۷۵٪ / ۱۰۰٪)' },
];

const KEYBOARD_ITEMS = [
  { key: '1 - 4', desc: 'تنظیم درصد اعزام نیرو (۲۵٪ تا ۱۰۰٪)' },
  { key: 'Tab', desc: 'جابه‌جایی سریع میان قلعه‌های خط مقدم خود' },
  { key: 'Space', desc: 'حمله سریع به همسایه زیر نشانگر یا ضعیف‌ترین همسایه' },
  { key: 'A / S', desc: 'فراخوانی کمکی هم‌مرز / تنظیم خط تأمین خودکار' },
  { key: 'Q / W / E / R', desc: 'ساخت سربازخانه، برج دفاعی، معدن طلا، آهنگری نبرد' },
  { key: 'Z / X / C', desc: 'بسیج عمومی، یورش برق‌آسا، سپر سلطنتی' },
  { key: 'F / L / B', desc: 'سرعت بازی (۱× تا ۲×)، گزارش نبرد، موسیقی ۱۶ بیتی' },
  { key: 'N / P / M / H', desc: 'نقشه جدید، توقف بازی، قطع کل صدا، راهنمای کلیدها' },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070d17]/82"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[88dvh] overflow-y-auto bg-[#101827] border-2 border-[#d6b472]/45 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#25354f]">
          <div>
            <h2 id="shortcuts-modal-title" className="text-base font-black text-[#f6efe0]">
              کلیدهای میانبر و فرماندهی سریع
            </h2>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">
              تمامی کلیدها با کیبورد فارسی و انگلیسی بدون نیاز به تغییر زبان کار می‌کنند.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن راهنمای کلیدها"
            className="min-w-[36px] min-h-[36px] bg-[#1a263b] hover:bg-[#243452] border-2 border-[#334866] text-[#e2e8f0] font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <section>
            <h3 className="text-xs font-extrabold text-[#d6b472] mb-2">
              حرکات سریع ماوس و لمسی
            </h3>
            <div className="space-y-1.5">
              {MOUSE_TOUCH_ITEMS.map((item) => (
                <div
                  key={item.trigger}
                  className="flex items-center justify-between gap-3 bg-[#152033] border border-[#24344d] px-3 py-2 text-xs"
                >
                  <span className="font-bold text-[#f2e8d5] shrink-0">{item.trigger}</span>
                  <span className="text-[#a8b6c9] text-left">{item.desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-extrabold text-[#d6b472] mb-2">
              میانبرهای صفحه‌کلید
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {KEYBOARD_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 bg-[#152033] border border-[#24344d] px-2.5 py-2 text-[11px]"
                >
                  <span className="text-[#cbd5e1]">{item.desc}</span>
                  <kbd className="font-num px-1.5 py-0.5 bg-[#0b1220] border border-[#364d70] text-[#fde68a] font-bold shrink-0">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full min-h-[42px] py-2 bg-[#c99846] hover:bg-[#b58636] text-[#0c1320] font-extrabold text-xs transition-colors cursor-pointer"
        >
          متوجه شدم
        </button>
      </div>
    </div>
  );
}
