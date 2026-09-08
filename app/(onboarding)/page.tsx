"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SLIDES } from "@/constants/onboarding";

function AnimatedCircle({ accent }: { accent: string }) {
  return (
    <motion.div
      key={`circle-${accent}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 0.06 }}
      transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
      className="pointer-events-none absolute -bottom-[10vh] -right-[20vw] rounded-full"
      style={{
        width: "150vw",
        height: "150vw",
        maxWidth: 900,
        maxHeight: 900,
        backgroundColor: accent,
      }}
    />
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = SLIDES[currentIndex];

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    document.cookie = "onboarding_complete=true; path=/; max-age=31536000";
    router.push("/login");
  };

  let wordIndex = 0;

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-paper">
      <AnimatedCircle accent={slide.accent} />

      <header className="px-6 pt-8 md:px-12">
        <span className="font-display text-xl italic">Mindrop</span>
      </header>

      <section className="flex flex-1 items-center px-6 md:px-12">
        <div className="w-full max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.215, 0.61, 0.355, 1] }}
          >
            <p
              className="mb-4 text-[11px] font-bold tracking-[1.5px]"
              style={{ color: slide.accent }}
            >
              {slide.eyebrow}
            </p>

            <h1 className="mb-5 font-display text-5xl leading-[1.08] md:text-6xl">
              {slide.headline.split("\n").map((line, lineIdx) => (
                <span key={lineIdx} className="block">
                  {line.split(" ").map((word) => {
                    const delay = wordIndex++ * 0.06;
                    return (
                      <motion.span
                        key={`${lineIdx}-${word}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          delay,
                          duration: 0.4,
                          ease: [0.215, 0.61, 0.355, 1],
                        }}
                        className="inline-block"
                      >
                        {word}&nbsp;
                      </motion.span>
                    );
                  })}
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="max-w-[300px] text-[15px] leading-6 text-[#555555] md:max-w-md md:text-base"
            >
              {slide.sub}
            </motion.p>
          </motion.div>
        </AnimatePresence>
        </div>
      </section>

      {/* Footer */}
      <footer className="min-h-[140px] px-6 pb-10 md:px-12">
        <div className="mb-6 flex justify-center gap-2">
          {SLIDES.map((s, i) => (
            <motion.span
              key={s.id}
              animate={{
                width: i === currentIndex ? 24 : 6,
                backgroundColor: i === currentIndex ? s.accent : "#e5e5e5",
              }}
              transition={
                i === currentIndex
                  ? { type: "spring", damping: 12 }
                  : { duration: 0.3 }
              }
              className="h-1.5 rounded-full"
            />
          ))}
        </div>

        <motion.button
          onClick={handleNext}
          whileTap={{ scale: 0.97 }}
          animate={{ backgroundColor: slide.accent }}
          className="h-14 w-full max-w-sm rounded-full font-medium text-white mx-auto block"
        >
          {currentIndex === SLIDES.length - 1 ? "Get Started" : "Continue"}
        </motion.button>

        {currentIndex === SLIDES.length - 1 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            onClick={finish}
            className="mt-4 w-full py-2 text-center text-[13px] text-[#888888]"
          >
            Already have an account? Sign In
          </motion.button>
        )}
      </footer>
    </main>
  );
}
