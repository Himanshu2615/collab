import { LoaderIcon } from "lucide-react";
import { useThemeStore } from "../store/useThemeStore";
import { motion } from "framer-motion";

const PageLoader = () => {
  const { theme } = useThemeStore();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base-100 mesh-gradient" data-theme={theme}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex items-center justify-center"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full shadow-[0_0_40px_rgba(var(--primary),0.2)]"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute w-10 h-10 bg-primary/20 rounded-full blur-xl"
        />
        <div className="absolute font-black text-primary text-xl">
          C
        </div>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 text-sm font-bold uppercase tracking-[0.4em] text-primary/60"
      >
        Loading Collab...
      </motion.p>
    </div>
  );
};
export default PageLoader;
