#!/bin/bash
source .env

for function in $(find ./supabase/functions/* -maxdepth 1 -type d -exec basename {} \;); do
  supabase functions deploy $function --project-ref $PROJECT_REF --no-verify-jwt --legacy-bundle
done

