/**
 * Daftar konstanta izin RBAC sistem terintegrasi.
 * Format standar: <modul>.<resource>.<aksi>
 * Sesuai docs/03-keamanan.md dan docs/04-panduan-pengembangan.md
 */
export const PERMISSIONS = {
  // Core / IAM
  IAM_USER_READ: 'iam.user.read',
  IAM_USER_CREATE: 'iam.user.create',
  IAM_USER_UPDATE: 'iam.user.update',
  IAM_USER_DELETE: 'iam.user.delete',
  IAM_ROLE_READ: 'iam.role.read',
  IAM_ROLE_MANAGE: 'iam.role.manage',
  IAM_ORG_UNIT_READ: 'iam.org_unit.read',
  IAM_ORG_UNIT_MANAGE: 'iam.org_unit.manage',
  IAM_SESSION_READ: 'iam.session.read',
  IAM_SESSION_REVOKE: 'iam.session.revoke',

  // Kepegawaian (HR)
  HR_EMPLOYEE_READ: 'hr.employee.read',
  HR_EMPLOYEE_CREATE: 'hr.employee.create',
  HR_EMPLOYEE_UPDATE: 'hr.employee.update',
  HR_EMPLOYEE_DELETE: 'hr.employee.delete',
  HR_ASSIGNMENT_READ: 'hr.assignment.read',
  HR_ASSIGNMENT_MANAGE: 'hr.assignment.manage',
  HR_FAMILY_READ: 'hr.family.read',
  HR_FAMILY_MANAGE: 'hr.family.manage',
  HR_EDUCATION_READ: 'hr.education.read',
  HR_EDUCATION_MANAGE: 'hr.education.manage',
  HR_LEAVE_READ: 'hr.leave.read',
  HR_LEAVE_APPLY: 'hr.leave.apply',
  HR_LEAVE_APPROVE: 'hr.leave.approve',
  HR_LEAVE_BALANCE_MANAGE: 'hr.leave_balance.manage',
  HR_REFERENCE_MANAGE: 'hr.reference.manage',

  // Kinerja (Perf)
  PERF_CYCLE_READ: 'perf.cycle.read',
  PERF_CYCLE_MANAGE: 'perf.cycle.manage',
  PERF_GOAL_READ: 'perf.goal.read',
  PERF_GOAL_MANAGE: 'perf.goal.manage',
  PERF_PROGRESS_READ: 'perf.progress.read',
  PERF_PROGRESS_CREATE: 'perf.progress.create',
  PERF_APPRAISAL_READ: 'perf.appraisal.read',
  PERF_APPRAISAL_CREATE: 'perf.appraisal.create',
  PERF_APPRAISAL_EVALUATE: 'perf.appraisal.evaluate',
  PERF_APPRAISAL_FINALIZE: 'perf.appraisal.finalize',

  // Arsip (Archive)
  ARCHIVE_DOCUMENT_READ: 'archive.document.read',
  ARCHIVE_DOCUMENT_CREATE: 'archive.document.create',
  ARCHIVE_DOCUMENT_UPDATE: 'archive.document.update',
  ARCHIVE_DOCUMENT_MANAGE: 'archive.document.manage',
  ARCHIVE_DOCUMENT_DESTROY: 'archive.document.destroy',
  ARCHIVE_VERSION_READ: 'archive.version.read',
  ARCHIVE_VERSION_CREATE: 'archive.version.create',
  ARCHIVE_DISPOSITION_READ: 'archive.disposition.read',
  ARCHIVE_DISPOSITION_CREATE: 'archive.disposition.create',
  ARCHIVE_DISPOSITION_ACTION: 'archive.disposition.action',
  ARCHIVE_CATEGORY_MANAGE: 'archive.category.manage',
  ARCHIVE_LOCATION_MANAGE: 'archive.location.manage',
  ARCHIVE_DISPOSAL_MANAGE: 'archive.disposal.manage',

  // Buku Tamu (Guest)
  GUEST_VISITOR_READ: 'guest.visitor.read',
  GUEST_VISITOR_MANAGE: 'guest.visitor.manage',
  GUEST_APPOINTMENT_READ: 'guest.appointment.read',
  GUEST_APPOINTMENT_CREATE: 'guest.appointment.create',
  GUEST_APPOINTMENT_APPROVE: 'guest.appointment.approve',
  GUEST_VISIT_READ: 'guest.visit.read',
  GUEST_VISIT_CREATE: 'guest.visit.create',
  GUEST_VISIT_CHECKOUT: 'guest.visit.checkout',

  // Manajemen Berkas (Files)
  FILES_UPLOAD: 'files.file.upload',
  FILES_DOWNLOAD: 'files.file.download',
  FILES_DELETE: 'files.file.delete',

  // Audit
  AUDIT_LOG_READ: 'audit.log.read',
  AUDIT_LOG_EXPORT: 'audit.log.export',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Memeriksa apakah sebuah string merupakan permission yang valid.
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(PERMISSIONS).includes(permission as Permission);
}
