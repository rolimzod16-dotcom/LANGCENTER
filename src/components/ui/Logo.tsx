type Props = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-10 w-10 rounded-xl text-base",
  md: "h-16 w-16 rounded-2xl text-2xl",
  lg: "h-20 w-20 rounded-3xl text-3xl",
};

export function Logo({ size = "md", className = "" }: Props) {
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-[#5b5fef] to-[#4f46e5] font-bold text-white shadow-lg shadow-indigo-200 ${sizes[size]} ${className}`}
    >
      LC
    </div>
  );
}