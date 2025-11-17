"""Cloudflare R2 (S3-compatible) client utilities"""
import os
from typing import Optional

try:
    import boto3  # type: ignore
except Exception:
    boto3 = None


def get_r2_client():
    """Get R2 S3 client instance"""
    if boto3 is None:
        print(f"[ERROR] boto3 is not installed", flush=True)
        return None
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    account_id = os.getenv("R2_ACCOUNT_ID")
    if not (access_key and secret_key and account_id):
        print(f"[ERROR] R2 credentials missing - R2_ACCESS_KEY_ID={bool(access_key)}, R2_SECRET_ACCESS_KEY={bool(secret_key)}, R2_ACCOUNT_ID={bool(account_id)}", flush=True)
        return None
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            endpoint_url=endpoint,
            region_name="auto",
        )
        print(f"[DEBUG] R2 client created successfully", flush=True)
        return s3
    except Exception as e:
        import traceback
        error_detail = f"Failed to create R2 client: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        return None


def r2_put_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> Optional[str]:
    """Upload bytes to R2 and return S3 URL"""
    s3 = get_r2_client()
    bucket = os.getenv("R2_BUCKET")
    if s3 is None:
        print(f"[ERROR] R2 client is None - boto3 may not be installed or R2 credentials are missing", flush=True)
        return None
    if not bucket:
        print(f"[ERROR] R2_BUCKET environment variable is not set", flush=True)
        return None
    try:
        print(f"[DEBUG] Attempting R2 upload: bucket={bucket}, key={key}, size={len(data)}, content_type={content_type}", flush=True)
        s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
        result_url = f"s3://{bucket}/{key}"
        print(f"[DEBUG] R2 upload successful: {result_url}", flush=True)
        return result_url
    except Exception as e:
        import traceback
        error_detail = f"R2 upload failed: {str(e)}\n{traceback.format_exc()}"
        print(f"[ERROR] {error_detail}", flush=True)
        return None


def r2_presign_get(key: str, expires_seconds: int = 3600) -> Optional[str]:
    """Generate presigned URL for R2 object"""
    s3 = get_r2_client()
    bucket = os.getenv("R2_BUCKET")
    if s3 is None or not bucket:
        return None
    try:
        url = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=int(expires_seconds),
        )
        return url
    except Exception:
        return None

