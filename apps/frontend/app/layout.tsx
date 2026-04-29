// @ts-ignore – CSS module side-effect imports
import "./globals.css";
// @ts-ignore – CSS module side-effect imports
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { Geist } from "next/font/google";
import { cn } from "@/src/lib/utils";
import AppShell from "@/src/components/AppShell";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: "Video Lab",
  description: "剧情 -> 镜头 -> 首尾帧 -> 视频",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body>
        <AppShell>{children}</AppShell>
        <ToastContainer
          position="top-right"
          autoClose={4000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="light"
        />
      </body>
    </html>
  );
}
