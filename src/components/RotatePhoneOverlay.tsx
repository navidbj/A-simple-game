import { RotatePhoneSvg } from './GameIcons';

interface RotatePhoneOverlayProps {
  onContinuePortrait: () => void;
}

export function RotatePhoneOverlay({ onContinuePortrait }: RotatePhoneOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rotate-phone-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#08101d]/95"
    >
      <div className="w-full max-w-xs bg-[#101827] border-2 border-[#d6b472]/45 p-6 text-center shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        <div className="mx-auto w-20 h-20 flex items-center justify-center mb-4">
          <RotatePhoneSvg className="w-16 h-16 text-[#d6b472] animate-phone-rotate" />
        </div>

        <h2
          id="rotate-phone-title"
          className="text-lg font-black text-[#f6efe0]"
        >
          گوشی را به حالت افقی بچرخانید
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-[#a8b6c9]">
          برای دید کامل نقشه پیکسلی، هدف‌گیری راحت با کشیدن انگشت و دسترسی سریع به دکمه‌های نبرد، حالت افقی بهترین تجربه را می‌دهد.
        </p>

        <button
          type="button"
          onClick={onContinuePortrait}
          className="mt-5 w-full min-h-[44px] py-2.5 px-4 bg-[#1c2a42] hover:bg-[#273a59] border-2 border-[#384f73] text-[#f2e8d5] font-bold text-xs transition-colors cursor-pointer"
        >
          ادامه در حالت عمودی
        </button>
      </div>
    </div>
  );
}
