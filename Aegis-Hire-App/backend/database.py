from supabase import create_client, Client
from supabase._sync.client import SupabaseException
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def get_supabase_client() -> Client:
    """
    Create and return a Supabase client instance.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        # Return None if Supabase credentials are not set
        return None
    
    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return client
    except SupabaseException:
        # Return None if Supabase client creation fails
        return None

# Initialize the client
supabase = get_supabase_client()
