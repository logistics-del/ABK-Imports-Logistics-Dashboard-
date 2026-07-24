from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    """Allows access only to users with the admin role."""

    message = "This action requires an Admin role."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "admin"
        )


class IsAdminOrReadOnly(BasePermission):
    """Viewers get read-only (GET/HEAD/OPTIONS); Admins get full access."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return getattr(request.user, "role", None) == "admin"
