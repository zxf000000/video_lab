import { IconCheck } from "@tabler/icons-react";

interface StepItem {
  key: string;
  label: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  activeStep: string;
  onStepClick: (key: string) => void;
}

export default function StepIndicator({ steps, activeStep, onStepClick }: StepIndicatorProps) {
  const activeIndex = steps.findIndex((s) => s.key === activeStep);

  return (
    <div className="sticky top-[76px] z-10 flex items-center gap-2 overflow-x-auto rounded-lg border border-line bg-panel/80 px-3 py-3 shadow-glow backdrop-blur-xl">
      {steps.map((step, i) => {
        const isCompleted = i < activeIndex;
        const isActive = i === activeIndex;

        return (
          <div key={step.key} className="flex items-center">
            <button
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-mint text-white shadow-[0_8px_20px_rgba(111,103,216,0.24)]"
                  : isCompleted
                    ? "bg-mint/10 text-mint hover:bg-mint/15"
                    : "bg-panel2 text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => onStepClick(step.key)}
              type="button"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-panel/20 text-white"
                    : isCompleted
                      ? "bg-panel2 text-mint"
                      : "bg-panel2 text-gray-500"
                }`}
              >
                {isCompleted ? <IconCheck size={10} stroke={2.5} /> : i + 1}
              </span>
              {step.label}
            </button>
            {i < steps.length - 1 && (
              <div className={`mx-2 hidden h-px w-5 sm:block ${isCompleted ? "bg-mint/40" : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
