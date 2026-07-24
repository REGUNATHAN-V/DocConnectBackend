const express = require("express");
const router = express.Router();
const securityController = require("../controllers/securityController");

// GET settings
router.get("/settings/:userId", securityController.getSecuritySettings);

// Update toggles (two-step) --> In futur we can add it 
// router.post("/updatetoggles", securityController.updateToggleSettings);

router.post("/requesttoggletwostep", securityController.requestToggleTwoStep);
router.post("/verifytwostep", securityController.verifyTwoStepOtp);
router.post("/updateloginalert", securityController.updateLoginAlert);


// Save last verified device
router.post("/savedevice", securityController.saveVerifiedDevice);

// Remove a device
router.post("/removedevice", securityController.removeDevice);
router.post("/removelastdeviceverify", securityController.verifyLastDeviceRemovalOtp);



module.exports = router;
