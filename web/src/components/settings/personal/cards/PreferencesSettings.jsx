/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useState, useEffect, useContext } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API, showSuccess, showError } from "../../../../helpers";
import { UserContext } from "../../../../context/User";
import { normalizeLanguage } from "../../../../i18n/language";
import { NativeSelect } from "../../../common/form/Primitives";
import { Card } from "../../../ui";

// Language options with native names
const languageOptions = [
	{ value: "zh-CN", label: "简体中文" },
	{ value: "zh-TW", label: "繁體中文" },
	{ value: "en", label: "English" },
	{ value: 'fr', label: 'Français'},
	{ value: 'ru', label: 'Русский'},
	{ value: 'ja', label: '日本語'},
	{ value: "vi", label: "Tiếng Việt" },
];

const PreferencesSettings = ({ t }) => {
	const { i18n } = useTranslation();
	const [userState, userDispatch] = useContext(UserContext);
	const [currentLanguage, setCurrentLanguage] = useState(
		normalizeLanguage(i18n.language) || "zh-CN",
	);
	const [loading, setLoading] = useState(false);

	// Load saved language preference from user settings
	useEffect(() => {
		if (userState?.user?.setting) {
			try {
				const settings = JSON.parse(userState.user.setting);
				if (settings.language) {
					const lang = normalizeLanguage(settings.language);
					setCurrentLanguage(lang);
					// Sync i18n with saved preference
					if (i18n.language !== lang) {
						i18n.changeLanguage(lang);
					}
				}
			} catch (e) {
				// Ignore parse errors
			}
		}
	}, [userState?.user?.setting, i18n]);

	const handleLanguagePreferenceChange = async (lang) => {
		if (lang === currentLanguage) return;

		setLoading(true);
		const previousLang = currentLanguage;

		try {
			// Update language immediately for responsive UX
			setCurrentLanguage(lang);
			i18n.changeLanguage(lang);
			localStorage.setItem('i18nextLng', lang);

			// Save to backend
			const res = await API.put("/api/user/self", {
				language: lang,
			});

			if (res.data.success) {
				showSuccess(t("语言偏好已保存"));
				// Keep backend preference, context state, and local cache aligned.
				let settings = {};
				if (userState?.user?.setting) {
					try {
						settings = JSON.parse(userState.user.setting) || {};
					} catch (e) {
						settings = {};
					}
				}
				settings.language = lang;
				const nextUser = {
					...userState.user,
					setting: JSON.stringify(settings),
				};
				userDispatch({
					type: "login",
					payload: nextUser,
				});
				localStorage.setItem("user", JSON.stringify(nextUser));
			} else {
				showError(res.data.message || t("保存失败"));
				// Revert on error
				setCurrentLanguage(previousLang);
				i18n.changeLanguage(previousLang);
				localStorage.setItem("i18nextLng", previousLang);
			}
		} catch (error) {
			showError(t("保存失败，请重试"));
			// Revert on error
			setCurrentLanguage(previousLang);
			i18n.changeLanguage(previousLang);
			localStorage.setItem("i18nextLng", previousLang);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card padding='md'>
			{/* Card Header */}
			<div className="flex items-center mb-4">
				<div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center mr-3">
					<Globe size={16} className="text-violet-600" />
				</div>
				<div>
					<span className="text-lg font-medium text-ui-text">
						{t("偏好设置")}
					</span>
					<div className="text-xs text-ui-text-2 dark:text-ui-text-3">
						{t("界面语言和其他个人偏好")}
					</div>
				</div>
			</div>
			{/* Language Setting Card */}
			<Card padding='md' radius='md'>
				<div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
					<div className="flex items-start w-full sm:w-auto">
						<div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mr-4 flex-shrink-0">
							<Globe size={20} className="text-violet-600" />
						</div>
						<div>
							<h6 className="text-sm font-semibold text-ui-text mb-1">
								{t("语言偏好")}
							</h6>
							<span className="text-sm text-ui-text-2">
								{t("选择您的首选界面语言，设置将自动保存并同步到所有设备")}
							</span>
						</div>
					</div>
					<div style={{ width: 180 }}>
						<NativeSelect
							value={currentLanguage}
							onChange={handleLanguagePreferenceChange}
							options={languageOptions}
							disabled={loading}
						/>
					</div>
				</div>
			</Card>

			{/* Additional info */}
			<div className="mt-4 text-xs text-ui-text-2 dark:text-ui-text-3">
				<span className="text-ui-text-3">
					{t(
						"提示：语言偏好会同步到您登录的所有设备，并影响API返回的错误消息语言。",
					)}
				</span>
			</div>
		</Card>
	);
};

export default PreferencesSettings;
