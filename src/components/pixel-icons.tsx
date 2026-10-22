import type { ComponentType, SVGProps } from "react";
import * as Pixel from "pixelarticons/react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

/** One 24px, filled pixel family for controls, metadata and empty states. */
function icon(Component: ComponentType<SVGProps<SVGSVGElement>>) {
  return function PixelIcon({ size = 24, className = "", strokeWidth: _strokeWidth, ...props }: IconProps) {
    return <Component width={size} height={size} aria-hidden="true" focusable="false" shapeRendering="crispEdges" className={`pixel-icon ${className}`} {...props} />;
  };
}

export const ArrowLeft = icon(Pixel.ArrowLeft);
export const ArrowRight = icon(Pixel.ArrowRight);
export const ArrowDown = icon(Pixel.ArrowDown);
export const ArrowUp = icon(Pixel.ArrowUp);
export const ArrowUpRight = icon(Pixel.ExternalLink);
export const Check = icon(Pixel.Check);
export const CheckCheck = icon(Pixel.CheckDouble);
export const ChevronDown = icon(Pixel.ChevronDown);
export const CircleHelp = icon(Pixel.InfoBox);
export const Copy = icon(Pixel.Copy);
export const Flag = icon(Pixel.Flag);
export const GitBranch = icon(Pixel.GitBranch);
export const Hand = icon(Pixel.Hand);
export const Image = icon(Pixel.Image);
export const ImagePlus = icon(Pixel.ImageNew);
export const Leaf = icon(Pixel.Leaf);
export const Link2 = icon(Pixel.Link);
export const List = icon(Pixel.ListBox);
export const MapPin = icon(Pixel.MapPin);
export const Maximize2 = icon(Pixel.Expand);
export const Minimize2 = icon(Pixel.Collapse);
export const MessageCircle = icon(Pixel.Message);
export const Paintbrush = icon(Pixel.Brush);
export const Pencil = icon(Pixel.Pencil);
export const Plus = icon(Pixel.Plus);
export const Minus = icon(Pixel.Minus);
export const Search = icon(Pixel.Search);
export const Send = icon(Pixel.Send);
export const Shuffle = icon(Pixel.Shuffle);
export const Sparkles = icon(Pixel.Sparkles);
export const StickyNote = icon(Pixel.Note);
export const Trash2 = icon(Pixel.Trash);
export const Undo2 = icon(Pixel.Undo);
export const UserRound = icon(Pixel.User);
export const UsersRound = icon(Pixel.Users);
export const WifiOff = icon(Pixel.Wifi);
export const X = icon(Pixel.Close);
export const Globe2 = icon(Pixel.Globe);
export const Type = icon(Pixel.TextStartT);
export const Quote = icon(Pixel.QuoteTextInline);
export const Compass = icon(Pixel.Compass);
