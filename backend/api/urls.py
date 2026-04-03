from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .stripe_webhooks import stripe_webhook

router = DefaultRouter()
router.register(r'cards/master', views.CardMasterViewSet, basename='cardmaster')
router.register(r'listings', views.CardListingViewSet, basename='card-listing')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'offers', views.OfferViewSet, basename='offer')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')
router.register(r'card-grades', views.CardGradeViewSet, basename='cardgrade')

urlpatterns = [
    path('auth/', include('dj_rest_auth.urls')),
    path('auth/registration/', include('dj_rest_auth.registration.urls')),
    path('auth/allauth/', include('allauth.urls')),
] + router.urls + [
    path('webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
    path('user/profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('cards/list/', views.CardMasterListAPIView.as_view(), name='card-list'),
    path('cards/<str:api_id>/', views.CardMasterDetailAPIView.as_view(), name='card-detail'),
    path('cards/<str:api_id>/stats/', views.CardDetailWithStatsAPIView.as_view(), name='card-stats'),
    path('cards/<str:api_id>/price-history/', views.CardPriceHistoryAPIView.as_view(), name='card-price-history'),
    path('sets/', views.SetListAPIView.as_view(), name='set-list'),
    path('rarities/', views.RarityListAPIView.as_view(), name='rarity-list'),
    path('series/', views.SeriesListAPIView.as_view(), name='series-list'),
    path('stats/', views.DatabaseStatsAPIView.as_view(), name='db-stats'),
    path('listings/analyze-photo/', views.AnalyzePhotoView.as_view(), name='listing-analyze-photo'),
    path('', views.api_root, name='api-root'),
]
