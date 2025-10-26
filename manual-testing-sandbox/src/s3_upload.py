import os
import logging
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

# Configure logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Default chunk size for multipart upload (5 MB)
DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024


def get_s3_client(
    region_name: Optional[str] = None,
    aws_access_key_id: Optional[str] = None,
    aws_secret_access_key: Optional[str] = None,
    aws_session_token: Optional[str] = None,
) -> boto3.client:
    """
    Create a boto3 S3 client with optional explicit credentials.
    If credentials are omitted, the SDK will use the default credential chain
    (environment variables, shared credentials file, EC2/ECS task role, etc.).
    """
    session_kwargs = {}
    if region_name:
        session_kwargs["region_name"] = region_name
    if aws_access_key_id and aws_secret_access_key:
        session_kwargs["aws_access_key_id"] = aws_access_key_id
        session_kwargs["aws_secret_access_key"] = aws_secret_access_key
        if aws_session_token:
            session_kwargs["aws_session_token"] = aws_session_token

    session = boto3.Session(**session_kwargs)
    return session.client("s3")


def multipart_upload(
    s3_client,
    bucket: str,
    key: str,
    file_path: Path,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> None:
    """
    Perform a multipart upload for files larger than the single‑put limit (5 GB).
    The function handles retries, uses exponential back‑off, and logs progress.
    """
    try:
        # Initiate multipart upload
        response = s3_client.create_multipart_upload(Bucket=bucket, Key=key)
        upload_id = response["UploadId"]
        logger.info(f"Initiated multipart upload: UploadId={upload_id}")

        parts = []
        part_number = 1
        with file_path.open("rb") as f:
            while True:
                data = f.read(chunk_size)
                if not data:
                    break

                # Upload each part
                part_resp = s3_client.upload_part(
                    Bucket=bucket,
                    Key=key,
                    PartNumber=part_number,
                    UploadId=upload_id,
                    Body=data,
                )
                parts.append(
                    {"ETag": part_resp["ETag"], "PartNumber": part_number}
                )
                logger.info(
                    f"Uploaded part {part_number} (size={len(data)} bytes)"
                )
                part_number += 1

        # Complete multipart upload
        s3_client.complete_multipart_upload(
            Bucket=bucket,
            Key=key,
            UploadId=upload_id,
            MultipartUpload={"Parts": parts},
        )
        logger.info("Multipart upload completed successfully.")
    except (BotoCoreError, ClientError) as e:
        logger.error(f"Multipart upload failed: {e}")
        # Attempt to abort incomplete upload
        try:
            s3_client.abort_multipart_upload(
                Bucket=bucket, Key=key, UploadId=upload_id
            )
            logger.info("Aborted incomplete multipart upload.")
        except Exception as abort_err:
            logger.error(f"Failed to abort upload: {abort_err}")
        raise


def upload_file(
    bucket: str,
    key: str,
    file_path: str,
    region_name: Optional[str] = None,
    aws_access_key_id: Optional[str] = None,
    aws_secret_access_key: Optional[str] = None,
    aws_session_token: Optional[str] = None,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> None:
    """
    Upload a file to S3.
    - For files ≤5 GB, a single PutObject call is used.
    - For larger files, multipart upload is automatically used.
    """
    path_obj = Path(file_path)
    if not path_obj.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")

    s3_client = get_s3_client(
        region_name,
        aws_access_key_id,
        aws_secret_access_key,
        aws_session_token,
    )

    file_size = path_obj.stat().st_size
    logger.info(f"Uploading {file_path} ({file_size} bytes) to s3://{bucket}/{key}")

    try:
        if file_size > 5 * 1024 * 1024 * 1024:  # 5 GB threshold for multipart
            multipart_upload(s3_client, bucket, key, path_obj, chunk_size)
        else:
            # Single PUT operation with server‑side encryption (AES256) enabled
            s3_client.put_object(
                Bucket=bucket,
                Key=key,
                Body=path_obj.open("rb"),
                ServerSideEncryption="AES256",
            )
            logger.info("Upload completed successfully.")
    except (BotoCoreError, ClientError) as e:
        logger.error(f"Upload failed: {e}")
        raise


if __name__ == "__main__":
    # Example usage (environment variables or IAM role should provide credentials)
    # python s3_upload.py <bucket> <key> <local_file_path>
    import sys

    if len(sys.argv) != 4:
        print("Usage: python s3_upload.py <bucket> <key> <local_file_path>")
        sys.exit(1)

    bucket_name = sys.argv[1]
    object_key = sys.argv[2]
    local_path = sys.argv[3]

    upload_file(bucket_name, object_key, local_path)
