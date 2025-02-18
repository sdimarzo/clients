import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { combineLatest, Observable, shareReplay, switchMap } from "rxjs";
import { filter, map, take } from "rxjs/operators";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherId, CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ButtonModule, DialogService, Icons, NoItemsModule } from "@bitwarden/components";
import { DecryptionFailureDialogComponent, VaultIcons } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { VaultPopupItemsService } from "../../services/vault-popup-items.service";
import { VaultPopupListFiltersService } from "../../services/vault-popup-list-filters.service";

import { BlockedInjectionBanner } from "./blocked-injection-banner/blocked-injection-banner.component";
import {
  NewItemDropdownV2Component,
  NewItemInitialValues,
} from "./new-item-dropdown/new-item-dropdown-v2.component";
import { VaultHeaderV2Component } from "./vault-header/vault-header-v2.component";

import { AutofillVaultListItemsComponent, VaultListItemsContainerComponent } from ".";

enum VaultState {
  Empty,
  NoResults,
  DeactivatedOrg,
}

@Component({
  selector: "app-vault",
  templateUrl: "vault-v2.component.html",
  standalone: true,
  imports: [
    BlockedInjectionBanner,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    NoItemsModule,
    JslibModule,
    CommonModule,
    AutofillVaultListItemsComponent,
    VaultListItemsContainerComponent,
    ButtonModule,
    RouterLink,
    NewItemDropdownV2Component,
    ScrollingModule,
    VaultHeaderV2Component,
    DecryptionFailureDialogComponent,
  ],
})
export class VaultV2Component implements OnInit, OnDestroy {
  cipherType = CipherType;

  protected favoriteCiphers$ = this.vaultPopupItemsService.favoriteCiphers$;
  protected remainingCiphers$ = this.vaultPopupItemsService.remainingCiphers$;
  protected loading$ = this.vaultPopupItemsService.loading$;

  protected newItemItemValues$: Observable<NewItemInitialValues> =
    this.vaultPopupListFiltersService.filters$.pipe(
      switchMap(
        async (filter) =>
          ({
            organizationId: (filter.organization?.id ||
              filter.collection?.organizationId) as OrganizationId,
            collectionId: filter.collection?.id as CollectionId,
            folderId: filter.folder?.id,
          }) as NewItemInitialValues,
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  /** Visual state of the vault */
  protected vaultState: VaultState | null = null;

  protected vaultIcon = VaultIcons.Vault;
  protected deactivatedIcon = VaultIcons.DeactivatedOrg;
  protected noResultsIcon = Icons.NoResults;

  protected VaultStateEnum = VaultState;

  constructor(
    private vaultPopupItemsService: VaultPopupItemsService,
    private vaultPopupListFiltersService: VaultPopupListFiltersService,
    private destroyRef: DestroyRef,
    private cipherService: CipherService,
    private dialogService: DialogService,
  ) {
    combineLatest([
      this.vaultPopupItemsService.emptyVault$,
      this.vaultPopupItemsService.noFilteredResults$,
      this.vaultPopupItemsService.showDeactivatedOrg$,
    ])
      .pipe(takeUntilDestroyed())
      .subscribe(([emptyVault, noResults, deactivatedOrg]) => {
        switch (true) {
          case emptyVault:
            this.vaultState = VaultState.Empty;
            break;
          case deactivatedOrg:
            // The deactivated org state takes precedence over the no results state
            this.vaultState = VaultState.DeactivatedOrg;
            break;
          case noResults:
            this.vaultState = VaultState.NoResults;
            break;
          default:
            this.vaultState = null;
        }
      });
  }

  async ngOnInit() {
    this.cipherService.failedToDecryptCiphers$
      .pipe(
        map((ciphers) => ciphers.filter((c) => !c.isDeleted)),
        filter((ciphers) => ciphers.length > 0),
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((ciphers) => {
        DecryptionFailureDialogComponent.open(this.dialogService, {
          cipherIds: ciphers.map((c) => c.id as CipherId),
        });
      });
  }

  ngOnDestroy(): void {}
}
