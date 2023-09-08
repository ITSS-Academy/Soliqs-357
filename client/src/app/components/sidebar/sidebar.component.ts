import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  inject,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Router } from '@angular/router';
import { Subscription, combineLatest, mergeMap } from 'rxjs';

import { AuthState } from 'src/app/ngrx/states/auth.state';

import { FormControl, FormGroup, Validators } from '@angular/forms';

import { PostState } from 'src/app/ngrx/states/post.state';

import { Profile } from 'src/app/models/profile.model';
import { ProfileState } from 'src/app/ngrx/states/profile.state';

import { Store } from '@ngrx/store';
import { StorageState } from 'src/app/ngrx/states/storage.state';

import * as AuthActions from '../../ngrx/actions/auth.actions';
import * as StorageActions from '../../ngrx/actions/storage.actions';
import * as PostActions from '../../ngrx/actions/post.actions';
import * as ProfileActions from '../../ngrx/actions/profile.actions';
import { UserState } from 'src/app/ngrx/states/user.state';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent implements OnInit, OnDestroy {
  currentPage?: string = '';
  themeColor: 'primary' | 'accent' | 'warn' = 'primary'; // ? notice this
  isDark = false; // ? notice this

  subscriptions: Subscription[] = [];

  page: number = 0;

  idToken: string = '';
  idToken$ = this.store.select('auth', 'idToken');

  selectedImage: string | ArrayBuffer | null = null;

  profile: Profile = <Profile>{};
  profile$ = this.store.select('profile', 'profile');
  isGetProfileSuccess$ = this.store.select('profile', 'isSuccess');

  isCreatingPost$ = this.store.select('post', 'isLoading');
  isCreatePostSuccess$ = this.store.select('post', 'isSuccess');
  errorMessage$ = this.store.select('post', 'errorMessage');

  storage$ = this.store.select('storage', 'storage');
  isCreateSuccess$ = this.store.select('storage', 'isCreateSuccess');
  isGetSuccess$ = this.store.select('storage', 'isGetSuccess');

  user$ = this.store.select('user', 'user');

  formData: FormData = new FormData();
  fileName: string = '';
  file: any;

  id: string = '';

  isHaveImage = true;

  storageForm = new FormData();

  constructor(
    private overlayContainer: OverlayContainer,
    private router: Router,
    private store: Store<{
      auth: AuthState;
      storage: StorageState;
      profile: ProfileState;
      post: PostState;
      user: UserState;
    }>,
    private _snackBar: MatSnackBar
  ) {}

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    this.formData.append('image', file, file.name);
    this.file = file;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      this.selectedImage = reader.result;
    };
  }

  postForm = new FormGroup({
    id: new FormControl(''),
    authorId: new FormControl('', Validators.required),
    content: new FormControl('', Validators.required),
    media: new FormControl(''),
  });

  postData = {
    id: '',
    authorId: '',
    content: '',
    media: '',
  };

  ngOnInit(): void {
    const currentRoute = this.router.url;

    this.navItems.forEach((nav) => {
      if (nav.route == '/group/internal') {
      }

      if (nav.route === currentRoute) {
        nav.backgroundColor = true;
      } else {
        nav.backgroundColor = false;
      }
    });

    this.subscriptions.push(
      combineLatest([this.idToken$, this.user$]).subscribe(
        ([idToken, user]) => {
          if (idToken && user.uid) {
            this.store.dispatch(
              ProfileActions.get({ id: user.uid, idToken: idToken })
            );
            this.idToken = idToken;
          }
        }
      ),

      this.isGetProfileSuccess$
        .pipe(
          mergeMap((res) => {
            if (res) {
              return this.profile$;
            } else {
              return [];
            }
          })
        )
        .subscribe((profile) => {
          if (profile) {
            this.profile = profile;
          }
        }),

      this.isCreateSuccess$.subscribe((res) => {
        if (res) {
          this.store.dispatch(
            StorageActions.get({
              fileName: `posts/${this.profile.id}/${this.id}`,
              idToken: this.idToken,
            })
          );
        }
      }),

      this.isGetSuccess$
        .pipe(
          mergeMap((res) => {
            if (res) {
              return this.storage$;
            } else {
              return [];
            }
          })
        )
        .subscribe((storage) => {
          if (storage) {
            this.postData = {
              id: `posts/${this.profile.id}/${this.id}`,
              authorId: this.profile._id,
              content: this.postForm.value.content || '',
              media: storage.urls[0],
            };

            this.store.dispatch(
              PostActions.create({
                post: this.postData,
                idToken: this.idToken,
              })
            );
          }
        }),

      this.isCreatingPost$.subscribe((res) => {
        if (res) {
          this.openSnackBar('Creating...');
        }
      }),

      this.isCreatePostSuccess$.subscribe((res) => {
        if (res) {
          this.postData = {
            id: '',
            authorId: '',
            content: '',
            media: '',
          };
          this.postForm.reset();
          this.selectedImage = null;
          this.fileInput.nativeElement.value = '';
          // this.store.dispatch(
          //   PostActions.get({ page: this.page, pageSize: 5 })
          // );

          this.closePostDialog();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
  }

  uploadPost() {
    const id = Math.floor(
      Math.random() * Math.floor(Math.random() * Date.now())
    ).toString();

    this.id = id;

    if (this.file) {
      this.store.dispatch(
        StorageActions.create({
          file: this.file,
          fileName: `posts/${this.profile.id}/${id}`,
          idToken: this.idToken,
        })
      );
    } else {
      this.postData = {
        id: `posts/${this.profile.id}/${id}`,
        authorId: this.profile._id,
        content: this.postForm.value.content || '',
        media: '',
      };

      this.store.dispatch(
        PostActions.create({
          post: this.postData,
          idToken: this.idToken,
        })
      );
    }
  }

  openSnackBar(message: any) {
    this._snackBar.open(message, '', {
      horizontalPosition: 'end',
      verticalPosition: 'top',
      duration: 1000,
      panelClass: ['snackbar'],
    });
  }

  navItems = [
    { icon: 'home', text: 'Home', backgroundColor: false, route: '/home' },
    {
      icon: 'search',
      text: 'Search',
      backgroundColor: false,
      route: '/search',
    },
    { icon: 'notifications', text: 'Notifications', backgroundColor: false },
    { icon: 'chat', text: 'Message', backgroundColor: false, route: '/chat' },
    {
      icon: 'diversity_2',
      text: 'Group',
      backgroundColor: false,
      route: '/group/suggest',
    },
    {
      icon: 'account_circle',
      text: 'Profile',
      backgroundColor: false,
      route: '/profile',
    },
  ];

  @ViewChild('appDialog', { static: true })
  dialog!: ElementRef<HTMLDialogElement>;
  cdr = inject(ChangeDetectorRef);

  toggleTheme(): void {
    this.isDark = !this.isDark;
    if (this.isDark) {
      this.overlayContainer.getContainerElement().classList.add('dark-theme');
    } else {
      this.overlayContainer
        .getContainerElement()
        .classList.remove('dark-theme');
    }
  }

  changeBackgroundColor(selectedNav: any) {
    if (selectedNav.backgroundColor) {
      return;
    }

    this.navItems.forEach((nav) => {
      if (nav == selectedNav) {
        nav.backgroundColor = true;
        this.currentPage = nav.route;
      } else {
        nav.backgroundColor = false;
        // Đặt lại màu nền cho biểu tượng cũ
      }
    });

    this.router.navigate([selectedNav.route]);
  }

  return(icon: string) {
    this.router.navigate(['/home']);

    this.navItems.forEach((nav) => {
      nav.backgroundColor = nav.icon === icon;
    });
  }
  openPostDialog() {
    this.dialog.nativeElement.showModal();
    this.cdr.detectChanges();
  }
  closePostDialog() {
    this.dialog.nativeElement.close();
    this.cdr.detectChanges();
  }

  logout() {
    this.store.dispatch(AuthActions.logout());
  }
}
