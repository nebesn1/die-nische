import { Desktop } from "./desktop/Desktop";
import { VfsProvider } from "./vfs/VfsProvider";

export default function App() {
  return (
    <VfsProvider>
      <Desktop />
    </VfsProvider>
  );
}
