# thumbnails

## Local Development

### Minio setup

1. Add a local webhook notification endpoint at [minio settings](http://<minio-admin>:9001/settings/notification-endpoints/add/notify_webhook).

2. Enable events for your bucket at [bucket settings / Events](http://localhost:9001/buckets/<your-bucket>/admin/events).

3. Run the lambda as an API with the [minioHandler](./index.mts#L94).

    ```sh
    ## Run api at port 3333 for development with minio
    MINIO_IP=192.168.X.Y npm run start-api
    ```

### Build

1. Build dist/index.zip

    ```sh
    npm run build
    ```
