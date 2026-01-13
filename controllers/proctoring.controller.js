import cloudinary from "../config/cloudinary.js";
import Attempt from "../models/Attempt.model.js";
import Proctoring from "../models/ProctoringScreenshot.model.js";
import Test from "../models/Test.model.js";
import AppError from "../utils/AppError.js";

export const createProctoringScreenshot = async (req, res, next) => {
  try {
    // normalize candidate id from auth
    const candidate = req.user?.userId ?? req.user?._id;
    if (!candidate) return next(new AppError("Not authenticated", 401));

    const { sessionId, testSlug, testId: testIdRaw, takenAt } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "File missing" });
    }
    if (!sessionId || !takenAt) {
      return res
        .status(400)
        .json({ success: false, message: "sessionId and takenAt are required" });
    }
    if (!testSlug && !testIdRaw) {
      return res
        .status(400)
        .json({ success: false, message: "Provide either testSlug or testId" });
    }

    // Resolve test by id OR slug
    let testDoc = null;
    if (testIdRaw) {
      testDoc = await Test.findById(testIdRaw).select("_id slug");
    } else {
      testDoc = await Test.findOne({ slug: testSlug }).select("_id slug");
    }
    if (!testDoc) throw new AppError("Test not found", 404);

    // Upload to Cloudinary
    const folder = process.env.CLOUDINARY_FOLDER || "proctoring-screenshots";
    const publicId = `${sessionId}/${Date.now()}`;

    const upload = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            public_id: publicId,
            resource_type: "image",
            overwrite: false,
          },
          (err, resUpload) => (err ? reject(err) : resolve(resUpload))
        )
        .end(req.file.buffer);
    });

    // Save document (note: store test ObjectId and keep slug for convenience)
    const doc = await Proctoring.create({
      candidate,
      test: testDoc._id,
      sessionId,
      testSlug: testDoc.slug,               // keep a human-friendly identifier
      takenAt: new Date(takenAt),

      public_id:  upload.public_id,
      secure_url: upload.secure_url,
      width:      upload.width,
      height:     upload.height,
      bytes:      upload.bytes,
      format:     upload.format,
      created_at: upload.created_at,
    });

    return res.status(201).json({ success: true, status: 201, data: doc });
  } catch (error) {
    next(error);
  }
};

export const getProctoringScreenshot = async (req, res, next) => {
  try {
    const { attemptId } = req.params;

    const attempt = await Attempt.findById(attemptId)
      .populate("candidate", "name email")           // candidate details
      .populate("test", "testName slug category")    // test details
      .lean();

    if (!attempt) {
      return res.status(404).json({
        status: 404,
        success: false,
        message: "Attempt not found!",
      });
    }

    const candidateId =
      attempt.candidate?._id ? String(attempt.candidate._id) : String(attempt.candidate);
    const testId = attempt.test?._id ? String(attempt.test._id) : String(attempt.test);

    const shotsQuery = { candidate: candidateId, test: testId };

    const sessionId = attempt.submission?.metadata?.sessionId;
    if (sessionId) shotsQuery.sessionId = sessionId;

    // 3) Fetch screenshots (sorted by time)
    const screenshots = await Proctoring.find(shotsQuery)
      .sort({ takenAt: 1 })
      .lean();

    // 4) Respond with attempt + screenshots
    return res.status(200).json({
      status: 200,
      success: true,
      message: "Attempt details fetched successfully.",
      screenshots, 
      meta: {
        screenshotsCount: screenshots.length,
        filteredBySession: Boolean(sessionId),
      },
    });
  } catch (error) {
    next(error);
  }
};

