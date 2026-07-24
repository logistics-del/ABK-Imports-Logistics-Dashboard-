from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .permissions import IsAdminRole
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    UserCreateSerializer,
    ChangePasswordSerializer,
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ -> {access, refresh, user}"""
    serializer_class = CustomTokenObtainPairSerializer


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin-only CRUD for dashboard users (User Management panel).
    Every authenticated user can read/update their own profile via /me/.
    """
    queryset = User.objects.all().order_by("-created_at")
    serializer_class = UserSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ("me", "change_password"):
            return [IsAuthenticated()]
        return [IsAdminRole()]

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        if request.method == "PATCH":
            serializer = UserSerializer(request.user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(UserSerializer(request.user).data)

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"detail": "Old password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password updated successfully."})
