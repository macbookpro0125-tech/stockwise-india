import { useInView } from "./motion.js";

// Fades and lifts its content in once it scrolls into view, the way product
// pages bring in each block of copy. `delay` staggers neighbours (in steps).
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} className={`ap-reveal${inView ? " in" : ""}${className ? ` ${className}` : ""}`} style={{ "--d": delay }} {...rest}>
      {children}
    </Tag>
  );
}
