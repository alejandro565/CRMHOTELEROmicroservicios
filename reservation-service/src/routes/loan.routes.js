const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/loan.controller');
const { authenticate, requirePermission } = require('../middlewares/authenticate');

router.use(authenticate);

const lendRules = [
  body('res_room_id').isUUID(),
  body('item_id').isUUID(),
  body('item_name').notEmpty(),
  body('quantity').isInt({ min: 1 }),
];

// GET  /loans/:resRoomId          — list loans for a room (?status=LENT)
// POST /loans                     — lend an item
// PATCH /loans/:loanId/return     — mark returned
// PATCH /loans/:loanId/lost       — mark lost

router.get('/:resRoomId',          requirePermission('LOANS_MANAGE'), ctrl.list);
router.post('/',                   requirePermission('LOANS_MANAGE'), lendRules, ctrl.lend);
router.patch('/:loanId/return',    requirePermission('LOANS_MANAGE'), ctrl.returnLoan);
router.patch('/:loanId/lost',      requirePermission('LOANS_MANAGE'), ctrl.markLost);

module.exports = router;
