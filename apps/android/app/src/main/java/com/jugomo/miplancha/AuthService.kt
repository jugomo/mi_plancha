package com.jugomo.miplancha

import com.google.android.gms.tasks.Task
import com.google.firebase.auth.AuthResult
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

class AuthService(
//    val user: Usuario?,
//    val isRestoringSession: Boolean
) {
    private var _mutableUser : MutableStateFlow<Usuario?>
    private var _mutableIsRestoring : MutableStateFlow<Boolean>

    lateinit var mutableUser: StateFlow<Usuario?>
    lateinit var mutableIsRestoring : StateFlow<Boolean>

    init {
        _mutableUser = MutableStateFlow(null)
        _mutableIsRestoring = MutableStateFlow(true)

        mutableUser = _mutableUser.asStateFlow()
        mutableIsRestoring =_mutableIsRestoring.asStateFlow()
    }

    suspend fun startSession(companyId: String, username: String, password: String) {
        val syntheticEmail = UsernameEmail.syntheticEmail(companyId, username)
        val res: AuthResult = FirebaseAuth.getInstance()
            .signInWithEmailAndPassword(syntheticEmail, password).await()

        val uid = res.user?.uid
        if (uid != null) {
            _mutableUser.value = getUser(uid)

        }

    }

    fun restaurarSesionSiHayUsuarioActivo() {

    }

    fun closeSession() {

    }

    private suspend fun getUser(uid: String): Usuario? {
        val userSnapshot = FirebaseFirestore.getInstance()
            .collection("usuarios")
            .document(uid).get().await();

        val user = userSnapshot.toObject(Usuario::class.java)
        return user;
    }
}