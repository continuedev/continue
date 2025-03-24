// // import { RefObject, useCallback, useEffect, useMemo, useState } from "react";

// // interface PopoverSizes {
// //   maxHeight: number;
// //   minHeight: number;
// //   minWidth: number;
// //   maxWidth: number;
// // }

// // interface PopoverStyles  {
// //   right?: number;
// //   left?: number;
// //   top?: string;
// //   bottom?: string;
// // }

// // const DEFAULT_POPOVER_MAX_HEIGHT = 300;
// // const DEFAULT_POPOVER_MIN_HEIGHT = 100;
// // const DEFAULT_POPOVER_MIN_WIDTH = 100;
// // const DEFAULT_POPOVER_MAX_WIDTH = 400;

// // export const usePopoverPosition = (
// //   containerRef: RefObject<HTMLDivElement>,
// //   popoverRef: RefObject<HTMLDivElement>,
// //   defaultHorizontalAlign: "left" | "right",
// //   defaultVerticalAlign: "bottom" | "top",
// // ) => {
// //   // const defaultSizes = useMemo(() => {
// //   //   return {
// //   //     minHeight: defaults?.minHeight ?? DEFAULT_POPOVER_MIN_HEIGHT,
// //   //     maxHeight: defaults?.maxHeight ?? DEFAULT_POPOVER_MAX_HEIGHT,
// //   //     minWidth: defaults?.minWidth ?? DEFAULT_POPOVER_MIN_WIDTH,
// //   //     maxWidth: defaults?.maxWidth ?? DEFAULT_POPOVER_MAX_WIDTH,
// //   //   };
// //   // }, [defaults]);

// //   const [styles, setStyles] = useState<PopoverStyles>({
// //     top: defaultVerticalAlign === "top" ? "100%" : undefined,
// //     bottom: defaultVerticalAlign === "bottom" ? "100%" : undefined,
// //     right: defaultHorizontalAlign === "right" ? 0 : undefined,
// //     left: defaultHorizontalAlign === "left" ? undefined : 0,
// //   });

// //   const calculatePosition = useCallback(() => {
// //     if (!containerRef?.current || !popoverRef?.current) {
// //       return;
// //     }
// //     const containerRect = containerRef.current.getBoundingClientRect();
// //     const popoverRect = popoverRef.current.getBoundingClientRect();

// //     // Decide to show popup above or below and determine min/max height
// //     const spaceBelow = window.innerHeight - rect.bottom;
// //     const spaceAbove = rect.top;
// //     const showBelow = spaceBelow > spaceAbove;
// //     const verticalSpace = showBelow ? spaceBelow : spaceAbove;
// //     // const maxHeight = Math.min(defaultSizes.maxHeight, verticalSpace);
// //     // const minHeight = Math.min(defaultSizes.minHeight, verticalSpace);

// //     // Decide to show popup aligned left/right/left window/right window
// //     const minWidth = Math.min(window.innerWidth, defaultSizes.minWidth);
// //     const maxWidth = Math.min(window.innerWidth, defaultSizes.maxWidth);

// //     // const spaceRight = window.innerWidth - rect.left; // including container
// //     // const spaceLeft = rect.right; // including container

// //     // const alignLeft = spaceRight > spaceLeft;

// //     // // TODO fix this optimization
// //     // const horizontalSpace = alignLeft ? spaceRight : spaceLeft;
// //     // const showCenter = horizontalSpace < defaultSizes.minWidth;

// //     const distanceToEdge = defaultAlign === "right" ? rect.right : window.innerWidth - rect.left;
// //     const useAlign = distanceToEdge > maxWidth
// //     // const aligne

// //     setStyles({
// //       top: showBelow ? "100%" : undefined,
// //       bottom: showBelow ? undefined : "100%",
// //       right: defaultAlign === "right" ? (useAlign ? 0 : undefined): undefined,
// //       left: rect.right > maxWidth ? undefined : -rect.left,
// //     });

// //     // setPositionClass(
// //     //   `${showBelow ? "top-full" : "bottom-full"} ${align === "right" ? "right-0" : align === "left" ? "left-0" : "left-1/2 -translate-x-1/2"} `,
// //     // );
// //   }, [containerRef.current, popoverRef.current, defaultHorizontalAlign, defaultVerticalAlign]);

// //   useEffect(() => {
// //     calculatePosition();

// //     if(!containerRef.current || popoverRef.current) {
// //       return;
// //     }

// //       const handleResize = () => calculatePosition();
// //     window.addEventListener("resize", handleResize);

// //     if(containerRef)
// //       const containerObserver = new ResizeObserver((entries) => {
// //         calculatePosition();
// //       });
// //       containerObserver.observe(containerRef.current);

// //       return () => {
// //         observer.disconnect();
// //       };

// //     const resizeObserver = new ResizeObserver()
// //     containerRef.current?.addEventListener("resize")

// //     return () => window.removeEventListener("resize", handleResize);

// //   }, [calculatePosition, popoverRef.current,containerRef.current ]);

// //   const reCalculate = useCallback(() => {
// //     calculatePosition();
// //   }, [calculatePosition]);

// //   return { styles, reCalculate };
// // };

// import { RefObject, useEffect, useState } from "react";

// export const usePopoverPosition = (
//   containerRef: RefObject<HTMLDivElement>,
//   popoverRef: RefObject<HTMLDivElement>,
//   defaultHorizontalAlign: "left" | "right",
//   defaultVerticalAlign: "bottom" | "top",
// ) => {
//   const [styles, setStyles] = useState<{ [key: string]: number | string }>({});

//   useEffect(() => {
//     console.log(containerRef, popoverRef);
//     const calculatePosition = () => {
//       if (!containerRef.current || !popoverRef.current) return;

//       const containerRect = containerRef.current.getBoundingClientRect();
//       const popoverRect = popoverRef.current.getBoundingClientRect();
//       const windowWidth = window.innerWidth;
//       const windowHeight = window.innerHeight;

//       // Calculate horizontal position
//       let left: number | undefined;
//       let right: number | undefined;

//       if (defaultHorizontalAlign === "left") {
//         if (containerRect.left + popoverRect.width <= windowWidth) {
//           left = containerRect.left;
//         } else {
//           right = windowWidth - containerRect.right;
//         }
//       } else {
//         if (containerRect.right - popoverRect.width >= 0) {
//           right = windowWidth - containerRect.right;
//         } else {
//           left = 0;
//         }
//       }

//       // Calculate vertical position
//       let top: number | string | undefined;
//       let bottom: number | string | undefined;

//       if (defaultVerticalAlign === "bottom") {
//         if (containerRect.bottom + popoverRect.height <= windowHeight) {
//           top = "100%";
//         } else {
//           bottom = "100%";
//         }
//       } else {
//         if (containerRect.top - popoverRect.height >= 0) {
//           bottom = "100%";
//         } else {
//           top = "100%";
//         }
//       }

//       setStyles({
//         ...(left !== undefined && { left }),
//         ...(right !== undefined && { right }),
//         ...(top !== undefined && { top }),
//         ...(bottom !== undefined && { bottom }),
//         // position: "fixed",
//       });
//     };

//     calculatePosition();
//     window.addEventListener("resize", calculatePosition);
//     return () => window.removeEventListener("resize", calculatePosition);
//   }, [containerRef, popoverRef, defaultHorizontalAlign, defaultVerticalAlign]);

//   return styles;
// };
