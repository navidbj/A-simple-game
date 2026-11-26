import { StoneBrassStud, StoneCornerVine } from './HudOrnaments';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const MOUSE_TOUCH_ITEMS = [
  { trigger: 'کشیدن روی نقشه', desc: 'حمله یا ارسال نیروی کمکی به قلعه هم‌مرز' },
  { trigger: 'Shift + کلیک روی همسایه خودی', desc: 'ایجاد یا لغو خط تأمین خودکار (ارسال مداوم نیرو به خط مقدم)' },
  { trigger: 'دابل‌کلیک روی قلعه خود', desc: 'فراخوانی ۵۰٪ نیروی کمکی از تمام قلعه‌های هم‌مرز خودی' },
  { trigger: 'کلیک راست روی مقصد', desc: 'اعزام فوری ۱۰۰٪ نیروی قابل ارسال به قلعه هم‌مرز' },
  { trigger: 'اسکرول ماوس روی نقشه', desc: 'تغییر سریع درصد اعزام (۲۵٪ / ۵۰٪ / ۷۵٪ / ۱۰۰٪)' },
];

const KEYBOARD_ITEMS = [
  { key: '1 - 4', desc: 'تنظیم درصد اعزام نیرو (۲۵٪ تا ۱۰۰٪)' },
  { key: 'Tab', desc: 'جابه‌جایی سریع میان قلعه‌های خط مقدم خود' },
  { key: 'Space', desc: 'حمله سریع به همسایه زیر نشانگر یا ضعیف‌ترین همسایه' },
  { key: 'A / S', desc: 'فراخوانی کمکی هم‌مرز / تنظیم خط تأمین خودکار' },
  { key: 'Q / W / E / R / T', desc: 'سربازخانه، برج دفاعی، معدن، آهنگری، بندرگاه (ساحلی)' },
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#060c18]/84"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[88dvh] hud-stone-frame p-1.5"
      >
        <StoneCornerVine className="absolute -top-1.5 -left-1.5 w-10 h-9 z-20" />
        <StoneCornerVine flipX className="absolute -top-1.5 -right-1.5 w-10 h-9 z-20" />
        <StoneBrassStud className="absolute bottom-1 left-1 w-2.5 h-2.5 z-20" />
        <StoneBrassStud className="absolute bottom-1 right-1 w-2.5 h-2.5 z-20" />

        <div className="hud-wood-tray max-h-[calc(88dvh-16px)] overflow-y-auto p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#573b27]/70">
            <div>
              <h2 id="shortcuts-modal-title" className="text-base font-black text-[#fef08a]">
                کلیدهای میانبر و فرماندهی سریع
              </h2>
              <p className="text-[11px] text-[#d6c5ad] mt-0.5">
                تمامی کلیدها با کیبورد فارسی و انگلیسی بدون نیاز به تغییر زبان کار می‌کنند.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن راهنمای کلیدها"
              className="min-w-[40px] min-h-[40px] hud-wood-btn text-[#fef3c7] font-black text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <section>
              <h3 className="text-xs font-extrabold text-[#f3bd59] mb-2">
                حرکات سریع ماوس و لمسی
              </h3>
              <div className="space-y-1.5">
                {MOUSE_TOUCH_ITEMS.map((item) => (
                  <div
                    key={item.trigger}
                    className="flex items-center justify-between gap-3 hud-stone-inset px-3 py-2 text-xs"
                  >
                    <span className="font-bold text-[#fef3c7] shrink-0">{item.trigger}</span>
                    <span className="text-[#d6cbb8] text-left">{item.desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-extrabold text-[#f3bd59] mb-2">
                میانبرهای صفحه‌کلید
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {KEYBOARD_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 hud-stone-inset px-2.5 py-2 text-[11px]"
                  >
                    <span className="text-[#ede2cf]">{item.desc}</span>
                    <kbd className="hud-keycap font-num px-1.5 py-0.5 font-bold shrink-0">
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
            className="mt-5 w-full min-h-[44px] py-2 hud-gold-tile text-[#1d1206] font-black text-xs cursor-pointer"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
}
