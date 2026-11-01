export function Columns({
  cols = 2,
  children,
}: {
  cols?: number;
  children: React.ReactNode;
}) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };
  const colClass =
    colClasses[Math.min(cols, 4) as 1 | 2 | 3 | 4] || colClasses[2];

  return <div className={`my-6 grid gap-6 ${colClass}`}>{children}</div>;
}
