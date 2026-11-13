import type { StyleProp, ViewStyle } from "react-native";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleUserRound,
  ClipboardList,
  CloudOff,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flag,
  GraduationCap,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  Wallet,
  X,
  Zap,
} from "lucide-react-native";
import { Colors } from "../../constants/theme";

const icons = {
  "flash-outline": Zap,
  "arrow-back": ArrowLeft,
  "arrow-forward": ArrowRight,
  "notifications-outline": Bell,
  "bookmark-outline": Bookmark,
  bookmark: BookmarkCheck,
  "briefcase-outline": BriefcaseBusiness,
  "business-outline": Building2,
  "calendar-outline": CalendarDays,
  checkmark: Check,
  "checkmark-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-forward": ChevronRight,
  "chevron-up": ChevronUp,
  "alert-circle-outline": CircleAlert,
  "person-circle-outline": CircleUserRound,
  "cloud-offline-outline": CloudOff,
  "download-outline": Download,
  "open-outline": ExternalLink,
  "eye-outline": Eye,
  "eye-off-outline": EyeOff,
  "document-text-outline": FileText,
  "reader-outline": ClipboardList,
  "flag-outline": Flag,
  "school-outline": GraduationCap,
  "ribbon-outline": GraduationCap,
  "location-outline": MapPin,
  "chatbox-outline": MessageSquare,
  add: Plus,
  search: Search,
  "search-outline": Search,
  "shield-checkmark-outline": ShieldCheck,
  "options-outline": SlidersHorizontal,
  "sparkles-outline": Sparkles,
  "trash-outline": Trash2,
  "warning-outline": TriangleAlert,
  "cloud-upload-outline": Upload,
  "cash-outline": Wallet,
  close: X,
} as const;

/** Compatibility names let existing screen controls share one Lucide icon family. */
export function Icon({
  name,
  size = 18,
  color = Colors.foreground,
  style,
}: {
  name: keyof typeof icons;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      style={style}
      size={size}
      color={color}
      strokeWidth={1.5}
      aria-hidden
    />
  );
}
