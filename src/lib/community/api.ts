import { supabase } from "../supabase";
import { createCommunityTransport } from "./transport";
export const communityApi = createCommunityTransport(supabase.auth);
