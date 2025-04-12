import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/multer.middleware";

const router = Router()
router.use(verifyJWT) // Apply verifyJWT middleware to all routes in this file as all video operations are performed after user logs in

router
.route("/")
.get(getAllVideos)
.post(
    upload.fields([
        {
            name:"videoFile",
            maxCount: 1
        },
        {
            name:"thumbnail",
            maxCount: 1
        }
    ]),
    publishAVideo
)

router
.route("/:videoId")
.get(getVideoById)
.delete(deleteVideo)
.patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router